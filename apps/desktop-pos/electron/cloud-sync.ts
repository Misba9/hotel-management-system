import { lookup } from "node:dns/promises";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import type sqlite3 from "sqlite3";

export type SyncStatusPayload = {
  online: boolean;
  unsyncedCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  syncing: boolean;
};

type OrderRow = {
  id: number;
  order_number: string;
  table_number: string | null;
  source: string;
  total: number;
  status: string;
  created_at: string;
  synced_to_cloud: number;
};

type OrderItemRow = {
  product_id: number;
  quantity: number;
  price: number;
  notes: string | null;
  product_name: string | null;
};

type PaymentRow = {
  method: string;
  amount: number;
  status: string;
};

type DbHelpers = {
  all: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  get: <T>(sql: string, params?: unknown[]) => Promise<T | undefined>;
  run: (sql: string, params?: unknown[]) => Promise<void>;
};

const SYNC_INTERVAL_MS = 60_000;

function env(name: string): string | undefined {
  const raw = process.env[name];
  return raw?.trim() || undefined;
}

function sanitizePrivateKey(value: string | undefined): string | undefined {
  return value?.replace(/\\n/g, "\n");
}

function restaurantId(): string | null {
  return env("DESKTOP_POS_RESTAURANT_ID") ?? env("RESTAURANT_ID") ?? null;
}

function mapSourceToOrderType(source: string): string {
  if (source === "dine-in") return "dine_in";
  return "online";
}

function mapPaymentStatus(status: string): string {
  return status === "completed" ? "paid" : "pending";
}

function mapKitchenStatus(status: string): string {
  if (status === "ready") return "ready";
  if (status === "preparing") return "preparing";
  return "preparing";
}

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

function getAdminFirestore(): Firestore | null {
  if (adminDb) return adminDb;

  const projectId =
    env("FIREBASE_PROJECT_ID") ??
    env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ??
    env("VITE_FIREBASE_PROJECT_ID");
  const clientEmail = env("FIREBASE_CLIENT_EMAIL");
  const privateKey = sanitizePrivateKey(env("FIREBASE_PRIVATE_KEY"));

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey })
      });
    } else {
      adminApp = getApps()[0] ?? null;
    }
    adminDb = getFirestore(adminApp!);
    return adminDb;
  } catch (error) {
    console.error("[sync] Firebase Admin init failed:", error);
    return null;
  }
}

export async function isInternetAvailable(): Promise<boolean> {
  try {
    await lookup("firestore.googleapis.com");
    return true;
  } catch {
    return false;
  }
}

async function countUnsynced(db: DbHelpers): Promise<number> {
  const row = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM orders WHERE synced_to_cloud = 0"
  );
  return row?.count ?? 0;
}

async function loadUnsyncedOrders(db: DbHelpers): Promise<
  Array<{
    order: OrderRow;
    items: OrderItemRow[];
    payment: PaymentRow | null;
  }>
> {
  const orders = await db.all<OrderRow>(
    `SELECT id, order_number, table_number, source, total, status, created_at, synced_to_cloud
     FROM orders
     WHERE synced_to_cloud = 0
     ORDER BY created_at ASC
     LIMIT 25`
  );

  return Promise.all(
    orders.map(async (order) => {
      const items = await db.all<OrderItemRow>(
        `SELECT oi.product_id, oi.quantity, oi.price, oi.notes, p.name AS product_name
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      const payment = await db.get<PaymentRow>(
        `SELECT method, amount, status FROM payments WHERE order_id = ? LIMIT 1`,
        [order.id]
      );
      return { order, items, payment: payment ?? null };
    })
  );
}

function buildFirestoreOrderDoc(
  bundle: {
    order: OrderRow;
    items: OrderItemRow[];
    payment: PaymentRow | null;
  },
  restaurant: string
) {
  const { order, items, payment } = bundle;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.max(0, order.total - subtotal);

  return {
    id: `pos-${order.id}`,
    localOrderId: order.id,
    orderNumber: order.order_number,
    restaurantId: restaurant,
    source: order.source,
    orderType: mapSourceToOrderType(order.source),
    tableNumber: order.table_number ?? null,
    tableName: order.table_number ? `Table ${order.table_number}` : "Counter",
    items: items.map((item) => ({
      productId: String(item.product_id),
      name: item.product_name ?? `Item #${item.product_id}`,
      qty: item.quantity,
      unitPrice: item.price,
      lineTotal: Math.round(item.price * item.quantity * 100) / 100,
      ...(item.notes ? { note: item.notes } : {})
    })),
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: order.total,
    status: mapKitchenStatus(order.status),
    paymentMethod: payment?.method ?? "cash",
    paymentStatus: mapPaymentStatus(payment?.status ?? "completed"),
    syncedFrom: "desktop-pos",
    createdAt: new Date(order.created_at),
    updatedAt: FieldValue.serverTimestamp()
  };
}

export class CloudSyncEngine {
  private interval: NodeJS.Timeout | null = null;
  private syncing = false;
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;
  private onStatusChange: ((status: SyncStatusPayload) => void) | null = null;

  constructor(private readonly dbHelpers: DbHelpers) {}

  start(onStatusChange: (status: SyncStatusPayload) => void): void {
    this.onStatusChange = onStatusChange;
    void this.tick();
    this.interval = setInterval(() => {
      void this.tick();
    }, SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async runNow(): Promise<void> {
    await this.tick();
  }

  private async emitStatus(partial?: Partial<SyncStatusPayload>): Promise<void> {
    const unsyncedCount = await countUnsynced(this.dbHelpers);
    const online = (await isInternetAvailable()) && Boolean(getAdminFirestore()) && Boolean(restaurantId());

    const status: SyncStatusPayload = {
      online,
      unsyncedCount,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      syncing: this.syncing,
      ...partial
    };

    this.onStatusChange?.(status);
  }

  private async tick(): Promise<void> {
    await this.emitStatus({ syncing: this.syncing });

    const rid = restaurantId();
    if (!rid) {
      this.lastError = "DESKTOP_POS_RESTAURANT_ID not configured";
      await this.emitStatus();
      return;
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      this.lastError = "Firebase Admin credentials missing in root .env";
      await this.emitStatus();
      return;
    }

    const online = await isInternetAvailable();
    if (!online) {
      this.lastError = null;
      await this.emitStatus({ online: false });
      return;
    }

    const unsyncedCount = await countUnsynced(this.dbHelpers);
    if (unsyncedCount === 0) {
      this.lastError = null;
      await this.emitStatus({ online: true, unsyncedCount: 0 });
      return;
    }

    this.syncing = true;
    await this.emitStatus({ syncing: true, online: true });

    try {
      const bundles = await loadUnsyncedOrders(this.dbHelpers);
      for (const bundle of bundles) {
        const docId = `pos-${bundle.order.id}`;
        const docRef = firestore.collection("restaurants").doc(rid).collection("orders").doc(docId);
        await docRef.set(buildFirestoreOrderDoc(bundle, rid), { merge: true });
        await this.dbHelpers.run("UPDATE orders SET synced_to_cloud = 1 WHERE id = ?", [
          bundle.order.id
        ]);
        console.info(`[sync] Pushed order ${bundle.order.order_number} -> restaurants/${rid}/orders/${docId}`);
      }

      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      console.error("[sync] Batch push failed — will retry next interval:", message);
    } finally {
      this.syncing = false;
      await this.emitStatus();
    }
  }
}

export function createDbHelpers(db: sqlite3.Database): DbHelpers {
  return {
    run: (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    get: (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row as never);
        });
      }),
    all: (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as never[]);
        });
      })
  };
}
