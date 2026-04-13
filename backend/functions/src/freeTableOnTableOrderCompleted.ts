import { getFirestore } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

const db = getFirestore();

function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toUpperCase();
}

/**
 * Resolve `tables/{id}` document ids for a table order: prefer `tableId`, else query by `tableNumber` or `number`.
 */
export async function resolveTableDocIdsForTableOrder(
  data: FirebaseFirestore.DocumentData | undefined
): Promise<string[]> {
  if (!data) return [];
  const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
  if (tableId) return [tableId];

  const tn = data.tableNumber;
  if (typeof tn !== "number" || !Number.isFinite(tn)) return [];

  let snap = await db.collection("tables").where("tableNumber", "==", tn).limit(10).get();
  if (snap.empty) {
    snap = await db.collection("tables").where("number", "==", tn).limit(10).get();
  }
  return snap.docs.map((d) => d.id);
}

/**
 * When a table-service order transitions into COMPLETED, set matching `tables/*` to FREE (Admin SDK).
 * Covers admin/API completions and legacy orders missing `tableId`.
 */
export const onTableOrderCompletedFreeTable = onDocumentUpdated("orders/{orderId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after) return;

  if (String(after.orderType ?? "").toLowerCase() !== "table") return;

  const next = norm(after.status);
  const prev = norm(before?.status);
  if (next !== "COMPLETED" || prev === "COMPLETED") return;

  const ids = await resolveTableDocIdsForTableOrder(after);
  if (ids.length === 0) {
    console.warn("onTableOrderCompletedFreeTable: no table doc for order", event.params.orderId);
    return;
  }

  const batch = db.batch();
  for (const id of ids) {
    batch.update(db.collection("tables").doc(id), { status: "FREE" });
  }
  await batch.commit();
});
