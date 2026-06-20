import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { ipcMain } from "electron";
import type sqlite3 from "sqlite3";
import type { KitchenOrderPayload } from "./main-types";
import {
  insertPlatformOrder,
  parseFcmPlatformOrder,
  type PlatformOrderIngestPayload
} from "./platform-order-ingest";
import { printKitchenTicket } from "./receipt-printer";

type IngestHandlers = {
  onKitchenOrder: (order: KitchenOrderPayload) => void;
};

function env(name: string): string | undefined {
  const raw = process.env[name];
  return raw?.trim() || undefined;
}

function restaurantId(): string | null {
  return env("DESKTOP_POS_RESTAURANT_ID") ?? env("RESTAURANT_ID") ?? null;
}

function sanitizePrivateKey(value: string | undefined): string | undefined {
  return value?.replace(/\\n/g, "\n");
}

function getAdminDb() {
  const projectId =
    env("FIREBASE_PROJECT_ID") ??
    env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ??
    env("VITE_FIREBASE_PROJECT_ID");
  const clientEmail = env("FIREBASE_CLIENT_EMAIL");
  const privateKey = sanitizePrivateKey(env("FIREBASE_PRIVATE_KEY"));

  if (!projectId || !clientEmail || !privateKey) return null;

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey })
    });
  }

  return getFirestore();
}

async function markInboxProcessed(restaurant: string, orderId: string): Promise<void> {
  const db = getAdminDb();
  if (!db) return;

  await db
    .collection("restaurants")
    .doc(restaurant)
    .collection("posInbox")
    .doc(orderId)
    .set(
      {
        processed: true,
        processedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
}

let processingOrderIds = new Set<string>();

async function ingestPlatformOrder(
  db: sqlite3.Database,
  payload: PlatformOrderIngestPayload,
  handlers: IngestHandlers
): Promise<KitchenOrderPayload | null> {
  if (processingOrderIds.has(payload.orderId)) return null;
  processingOrderIds.add(payload.orderId);

  try {
    const kitchenOrder = await insertPlatformOrder(db, payload);
    if (!kitchenOrder) return null;

    handlers.onKitchenOrder(kitchenOrder);

    void printKitchenTicket({
      orderNumber: kitchenOrder.orderNumber,
      source: kitchenOrder.source,
      createdAt: kitchenOrder.createdAt,
      specialNotes: kitchenOrder.specialNotes,
      items: kitchenOrder.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        notes: item.notes
      }))
    }).then((result) => {
      if (!result.ok) {
        console.warn(`[print] Kitchen ticket skipped for ${kitchenOrder.orderNumber}`);
      }
    });

    const rid = restaurantId();
    if (rid) {
      await markInboxProcessed(rid, payload.orderId);
    }

    console.info(`[fcm] Platform order ingested: ${kitchenOrder.orderNumber}`);
    return kitchenOrder;
  } finally {
    processingOrderIds.delete(payload.orderId);
  }
}

export function registerFcmIpcHandlers(
  db: sqlite3.Database,
  handlers: IngestHandlers
): void {
  ipcMain.handle("fcm:registerToken", async (_event, token: string, deviceName?: string) => {
    const rid = restaurantId();
    const adminDb = getAdminDb();
    if (!rid || !adminDb || !token?.trim()) {
      return { ok: false, error: "missing_config_or_token" };
    }

    const deviceId = env("DESKTOP_POS_DEVICE_ID") ?? `pos-${process.platform}-${Date.now()}`;
    await adminDb
      .collection("restaurants")
      .doc(rid)
      .collection("posDevices")
      .doc(deviceId)
      .set(
        {
          fcmToken: token.trim(),
          deviceName: deviceName ?? "Desktop POS",
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    console.info(`[fcm] Registered POS device token for restaurant ${rid}`);
    return { ok: true, deviceId };
  });

  ipcMain.on("fcm:platform-order", (_event, data: Record<string, string>) => {
    const payload = parseFcmPlatformOrder(data);
    if (!payload) return;
    void ingestPlatformOrder(db, payload, handlers);
  });
}

export function startPosInboxListener(db: sqlite3.Database, handlers: IngestHandlers): () => void {
  const rid = restaurantId();
  const adminDb = getAdminDb();
  if (!rid || !adminDb) {
    console.warn("[fcm] POS inbox listener disabled — missing restaurant or Firebase Admin config");
    return () => undefined;
  }

  const unsubscribe = adminDb
    .collection("restaurants")
    .doc(rid)
    .collection("posInbox")
    .where("processed", "==", false)
    .onSnapshot(
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type !== "added" && change.type !== "modified") continue;
          const data = change.doc.data() as Record<string, unknown>;
          const payload: PlatformOrderIngestPayload = {
            orderId: String(data.orderId ?? change.doc.id),
            orderNumber: String(data.orderNumber ?? change.doc.id),
            source: data.source === "swiggy" ? "swiggy" : "zomato",
            customerName: typeof data.customerName === "string" ? data.customerName : undefined,
            phone: typeof data.phone === "string" ? data.phone : undefined,
            items: Array.isArray(data.items)
              ? (data.items as PlatformOrderIngestPayload["items"])
              : [],
            total: Number(data.total ?? 0),
            paymentMethod: typeof data.paymentMethod === "string" ? data.paymentMethod : "online",
            specialNotes: typeof data.specialNotes === "string" ? data.specialNotes : undefined
          };

          void ingestPlatformOrder(db, payload, handlers);
        }
      },
      (error) => {
        console.error("[fcm] POS inbox listener error:", error);
      }
    );

  console.info(`[fcm] Listening for platform orders on restaurants/${rid}/posInbox`);
  return unsubscribe;
}
