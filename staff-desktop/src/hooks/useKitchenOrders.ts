import { useEffect, useMemo, useRef, useState } from "react";
import { resolveOrderSource } from "@/lib/pos/order-source";
import { formatItemExtras } from "@/lib/pos/format-item-extras";
import { playNewOrderSound, resolveKitchenQueueStatus, type KitchenOrder } from "@/lib/kds-utils";
import { subscribeKitchenKdsOrders, type StaffOrderRow } from "@/services/orders";

function mapStaffOrderToKitchen(order: StaffOrderRow): KitchenOrder | null {
  const status = resolveKitchenQueueStatus(order);
  if (!status) return null;

  const src = resolveOrderSource(order);
  let source: KitchenOrder["source"] = "takeaway";
  if (src === "swiggy") source = "swiggy";
  else if (src === "zomato") source = "zomato";
  else if (src === "dine_in" || src === "waiter") source = "dine-in";

  const orderNumber =
    typeof order.tokenNumber === "number" && order.tokenNumber > 0
      ? `#${order.tokenNumber}`
      : `#${order.id.slice(-6).toUpperCase()}`;

  const ts = order.createdAt as { toMillis?: () => number; seconds?: number } | null;
  const createdAt =
    ts && typeof ts.toMillis === "function"
      ? new Date(ts.toMillis()).toISOString()
      : ts && typeof ts.seconds === "number"
        ? new Date(ts.seconds * 1000).toISOString()
        : new Date().toISOString();

  const raw = order as StaffOrderRow & { notes?: string };
  const tableLabel =
    order.tableName ??
    (typeof order.tableNumber === "number" ? String(order.tableNumber) : undefined);

  return {
    orderId: order.id,
    orderNumber,
    tableNumber: tableLabel,
    source,
    total: order.totalAmount,
    status,
    createdAt,
    specialNotes: raw.notes,
    items: order.items.map((it, index) => {
      const extras = formatItemExtras(it);
      return {
        productId: it.id || index,
        name: it.name,
        quantity: it.qty,
        price: it.price,
        ...(extras ? { notes: extras } : {})
      };
    })
  };
}

export function useKitchenOrders(enabled = true) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [rowsById, setRowsById] = useState<Map<string, StaffOrderRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeKitchenKdsOrders(
      (rows) => {
        const dedupedRows = new Map<string, StaffOrderRow>();
        for (const row of rows) dedupedRows.set(row.id, row);
        setRowsById(dedupedRows);

        const mapped = [...dedupedRows.values()]
          .map(mapStaffOrderToKitchen)
          .filter((o): o is KitchenOrder => o != null)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (!initialLoadRef.current) {
          const hasNew = mapped.some((o) => !knownIdsRef.current.has(o.orderId));
          if (hasNew) playNewOrderSound();
        }
        knownIdsRef.current = new Set(mapped.map((o) => o.orderId));
        initialLoadRef.current = false;

        setOrders(mapped);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    unsubRef.current = unsub;
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [enabled]);

  const activeOrders = useMemo(
    () => orders.filter((order) => ["accepted", "preparing"].includes(order.status)),
    [orders]
  );
  const newOrders = useMemo(() => orders.filter((order) => order.status === "new"), [orders]);
  const readyOrders = useMemo(() => orders.filter((order) => order.status === "ready"), [orders]);

  return { orders, rowsById, newOrders, activeOrders, readyOrders, loading, error };
}
