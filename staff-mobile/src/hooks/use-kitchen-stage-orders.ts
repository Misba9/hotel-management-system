import { useEffect, useRef, useState } from "react";

import {
  mapStaffOrderToHistory,
  mapStaffOrderToKitchen,
  sortKitchenOrders,
  type KitchenHistoryOrder,
  type KitchenStage
} from "../lib/kitchen-order-mapper";
import type { KitchenOrder } from "../lib/kitchen-kds";
import { staffPhysicalAlert } from "../services/notifications";
import {
  subscribeKitchenHistoryOrders,
  subscribeKitchenKdsOrders,
  type StaffOrderRow
} from "../../services/orders";

export type KitchenNavCounts = {
  active: number;
  ready: number;
};

function computeCounts(rows: StaffOrderRow[]): KitchenNavCounts {
  let active = 0;
  let ready = 0;
  for (const row of rows) {
    const status = row.canonicalStatus;
    if (status === "ready") ready += 1;
    else if (status === "new" || status === "accepted" || status === "preparing") active += 1;
  }
  return { active, ready };
}

function filterStageOrders(mapped: KitchenOrder[], stage: KitchenStage): KitchenOrder[] {
  if (stage === "ready") return mapped.filter((o) => o.status === "ready");
  if (stage === "active") {
    return mapped.filter((o) => o.status === "new" || o.status === "accepted" || o.status === "preparing");
  }
  return mapped;
}

function mapQueueRows(rows: StaffOrderRow[]) {
  const rowMap = new Map<string, StaffOrderRow>();
  for (const row of rows) rowMap.set(row.id, row);
  const mapped = sortKitchenOrders(
    rows.map((row) => mapStaffOrderToKitchen(row)).filter((o): o is KitchenOrder => o != null)
  );
  return { rowMap, mapped };
}

/**
 * One live KDS listener + optional history listener (no duplicate stage queries).
 */
export function useKitchenStageOrders(stage: KitchenStage, enabled = true) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [historyOrders, setHistoryOrders] = useState<KitchenHistoryOrder[]>([]);
  const [rowsById, setRowsById] = useState<Map<string, StaffOrderRow>>(new Map());
  const [counts, setCounts] = useState<KitchenNavCounts>({ active: 0, ready: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const knownNewIdsRef = useRef<Set<string>>(new Set());
  const initialActiveLoadRef = useRef(true);
  const queueRowsRef = useRef<StaffOrderRow[]>([]);
  const stageRef = useRef(stage);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setHistoryOrders([]);
      setRowsById(new Map());
      setCounts({ active: 0, ready: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const applyQueue = (rows: StaffOrderRow[]) => {
      queueRowsRef.current = rows;
      const { rowMap, mapped } = mapQueueRows(rows);
      setCounts(computeCounts(rows));

      const currentStage = stageRef.current;
      if (currentStage !== "history") {
        setRowsById(rowMap);
        setOrders(filterStageOrders(mapped, currentStage));
        setHistoryOrders([]);
        setLoading(false);
        setError(null);
      }

      if (currentStage === "active" && !initialActiveLoadRef.current) {
        const newIds = mapped.filter((o) => o.status === "new").map((o) => o.orderId);
        const hasNew = newIds.some((id) => !knownNewIdsRef.current.has(id));
        if (hasNew) void staffPhysicalAlert("kitchen_new");
      }
      if (currentStage === "active") {
        knownNewIdsRef.current = new Set(
          mapped.filter((o) => o.status === "new").map((o) => o.orderId)
        );
        initialActiveLoadRef.current = false;
      }
    };

    const unsubQueue = subscribeKitchenKdsOrders(
      applyQueue,
      (err) => {
        if (stageRef.current !== "history") {
          setError(err.message);
          setLoading(false);
        }
      }
    );

    let unsubHistory: (() => void) | undefined;
    if (stage === "history") {
      unsubHistory = subscribeKitchenHistoryOrders(
        (rows) => {
          const mapped = rows
            .map(({ order, data }) => mapStaffOrderToHistory(order, data))
            .filter((o): o is KitchenHistoryOrder => o != null);
          setHistoryOrders(mapped);
          setOrders([]);
          setRowsById(new Map());
          setLoading(false);
          setError(null);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
    } else if (queueRowsRef.current.length > 0) {
      const { rowMap, mapped } = mapQueueRows(queueRowsRef.current);
      setRowsById(rowMap);
      setOrders(filterStageOrders(mapped, stage));
      setHistoryOrders([]);
      setLoading(false);
    }

    return () => {
      unsubQueue();
      unsubHistory?.();
      knownNewIdsRef.current = new Set();
      initialActiveLoadRef.current = true;
      queueRowsRef.current = [];
    };
  }, [stage, enabled]);

  return { orders, historyOrders, rowsById, counts, loading, error };
}
