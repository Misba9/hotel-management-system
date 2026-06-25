import { useEffect, useRef, useState } from "react";
import {
  mapStaffOrderToHistory,
  mapStaffOrderToKitchen,
  sortKitchenOrders,
  type KitchenHistoryOrder,
  type KitchenStage
} from "@/lib/kitchen-order-mapper";
import { playNewOrderSound, type KitchenOrder } from "@/lib/kds-utils";
import {
  subscribeKitchenHistoryOrders,
  subscribeKitchenNewOrders,
  subscribeKitchenPreparingOrders,
  subscribeKitchenReadyOrders,
  type StaffOrderRow
} from "@/services/orders";

function mergeRows(newRows: StaffOrderRow[], preparingRows: StaffOrderRow[]): StaffOrderRow[] {
  const byId = new Map<string, StaffOrderRow>();
  for (const row of [...newRows, ...preparingRows]) byId.set(row.id, row);
  return [...byId.values()];
}

export function useKitchenStageOrders(stage: KitchenStage, enabled = true) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [historyOrders, setHistoryOrders] = useState<KitchenHistoryOrder[]>([]);
  const [rowsById, setRowsById] = useState<Map<string, StaffOrderRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const knownNewIdsRef = useRef<Set<string>>(new Set());
  const initialActiveLoadRef = useRef(true);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setHistoryOrders([]);
      setRowsById(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (stage === "history") {
      const unsub = subscribeKitchenHistoryOrders(
        (rows) => {
          const mapped = rows
            .map(({ order, data }) => mapStaffOrderToHistory(order, data))
            .filter((o): o is KitchenHistoryOrder => o != null);
          setHistoryOrders(mapped);
          setOrders([]);
          setRowsById(new Map());
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
      return () => unsub();
    }

    const applyRows = (rows: StaffOrderRow[], playSoundForNew: boolean) => {
      const rowMap = new Map<string, StaffOrderRow>();
      for (const row of rows) rowMap.set(row.id, row);
      setRowsById(rowMap);

      const mapped = sortKitchenOrders(
        [...rowMap.values()]
          .map((row) => mapStaffOrderToKitchen(row))
          .filter((o): o is KitchenOrder => o != null)
      );

      if (playSoundForNew && !initialActiveLoadRef.current) {
        const newIds = mapped.filter((o) => o.status === "new").map((o) => o.orderId);
        const hasNew = newIds.some((id) => !knownNewIdsRef.current.has(id));
        if (hasNew) playNewOrderSound();
      }
      if (playSoundForNew) {
        knownNewIdsRef.current = new Set(
          mapped.filter((o) => o.status === "new").map((o) => o.orderId)
        );
        initialActiveLoadRef.current = false;
      }

      setOrders(mapped);
      setHistoryOrders([]);
      setLoading(false);
      setError(null);
    };

    const onErr = (err: Error) => {
      setError(err.message);
      setLoading(false);
    };

    if (stage === "active") {
      let newRows: StaffOrderRow[] = [];
      let preparingRows: StaffOrderRow[] = [];

      const sync = () => applyRows(mergeRows(newRows, preparingRows), true);

      const unsubNew = subscribeKitchenNewOrders((rows) => {
        newRows = rows;
        sync();
      }, onErr);
      const unsubPreparing = subscribeKitchenPreparingOrders((rows) => {
        preparingRows = rows;
        sync();
      }, onErr);

      return () => {
        unsubNew();
        unsubPreparing();
        knownNewIdsRef.current = new Set();
        initialActiveLoadRef.current = true;
      };
    }

    const unsub = subscribeKitchenReadyOrders(
      (rows) => applyRows(rows, false),
      onErr
    );
    return () => unsub();
  }, [stage, enabled]);

  return { orders, historyOrders, rowsById, loading, error };
}
