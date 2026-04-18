import type { DocumentData, Timestamp } from "firebase/firestore";
import type { RestaurantOrderItemLine, TableServiceOrderDoc } from "../types/restaurant-floor-collections";

function readCreatedAt(r: Record<string, unknown>): Timestamp | null {
  const v = r.createdAt;
  if (v && typeof v === "object" && "seconds" in v && typeof (v as Timestamp).toMillis === "function") {
    return v as Timestamp;
  }
  return null;
}

function readQty(line: Record<string, unknown>): number {
  if (typeof line.qty === "number" && Number.isFinite(line.qty)) return line.qty;
  if (typeof line.quantity === "number" && Number.isFinite(line.quantity)) return line.quantity;
  return 1;
}

/**
 * Maps a raw `orders/{id}` document into the canonical table-service shape (`total`, `qty`).
 */
export function normalizeOrderDocToFloorShape(orderId: string, data: DocumentData | undefined): TableServiceOrderDoc | null {
  if (!data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const items: RestaurantOrderItemLine[] = itemsRaw.map((row) => {
    const line = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      name: typeof line.name === "string" ? line.name : "Item",
      price: Number(line.price ?? line.unitPrice ?? 0) || 0,
      qty: readQty(line)
    };
  });
  const totalRaw = r.total ?? r.totalAmount;
  const total = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : 0;
  const createdAt = readCreatedAt(r);
  return {
    id: orderId,
    tableId: typeof r.tableId === "string" ? r.tableId : "",
    status: typeof r.status === "string" ? r.status : "",
    items,
    total,
    createdAt
  };
}
