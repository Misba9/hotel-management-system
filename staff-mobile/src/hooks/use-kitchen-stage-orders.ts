import { useEffect, useMemo, useRef, useState } from "react";

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
 * One stable KDS queue listener for the kitchen shell lifetime.
 * Stage changes only re-filter client-side — never re-subscribe (avoids
 * Firestore "Target ID already exists").
 * History uses a separate listener only while the History tab is open.
 */
export function useKitchenStageOrders(stage: KitchenStage, enabled = true) {
  const [queueRows, setQueueRows] = useState<StaffOrderRow[]>([]);
  const [historyOrders, setHistoryOrders] = useState<KitchenHistoryOrder[]>([]);
  const [counts, setCounts] = useState<KitchenNavCounts>({ active: 0, ready: 0 });
  const [queueLoading, setQueueLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownNewIdsRef = useRef<Set<string>>(new Set());
  const initialActiveLoadRef = useRef(true);
  const stageRef = useRef(stage);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // Stable queue listener — depends only on `enabled`.
  useEffect(() => {
    if (!enabled) {
      setQueueRows([]);
      setCounts({ active: 0, ready: 0 });
      setQueueLoading(false);
      setError(null);
      knownNewIdsRef.current = new Set();
      initialActiveLoadRef.current = true;
      return;
    }

    setQueueLoading(true);
    setError(null);

    const unsubQueue = subscribeKitchenKdsOrders(
      (rows) => {
        setQueueRows(rows);
        setCounts(computeCounts(rows));
        setQueueLoading(false);
        setError(null);

        const { mapped } = mapQueueRows(rows);
        if (stageRef.current === "active" && !initialActiveLoadRef.current) {
          const newIds = mapped.filter((o) => o.status === "new").map((o) => o.orderId);
          const hasNew = newIds.some((id) => !knownNewIdsRef.current.has(id));
          if (hasNew) void staffPhysicalAlert("kitchen_new");
        }
        if (stageRef.current === "active") {
          knownNewIdsRef.current = new Set(
            mapped.filter((o) => o.status === "new").map((o) => o.orderId)
          );
          initialActiveLoadRef.current = false;
        }
      },
      (err) => {
        // Ignore transient target-id races during Fast Refresh / remount.
        if (err.message.includes("Target ID already exists")) {
          console.warn("[kitchen] ignoring transient Firestore target race");
          return;
        }
        setError(err.message);
        setQueueLoading(false);
      }
    );

    return () => {
      unsubQueue();
      knownNewIdsRef.current = new Set();
      initialActiveLoadRef.current = true;
    };
  }, [enabled]);

  // History listener — only while History tab is visible.
  useEffect(() => {
    if (!enabled || stage !== "history") {
      setHistoryOrders([]);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);

    const unsubHistory = subscribeKitchenHistoryOrders(
      (rows) => {
        const mapped = rows
          .map(({ order, data }) => mapStaffOrderToHistory(order, data))
          .filter((o): o is KitchenHistoryOrder => o != null);
        setHistoryOrders(mapped);
        setHistoryLoading(false);
        setError(null);
      },
      (err) => {
        if (err.message.includes("Target ID already exists")) {
          console.warn("[kitchen] ignoring transient Firestore history target race");
          return;
        }
        setError(err.message);
        setHistoryLoading(false);
      }
    );

    return () => {
      unsubHistory();
    };
  }, [enabled, stage]);

  const { orders, rowsById } = useMemo(() => {
    const { rowMap, mapped } = mapQueueRows(queueRows);
    if (stage === "history") {
      return { orders: [] as KitchenOrder[], rowsById: new Map<string, StaffOrderRow>() };
    }
    return {
      orders: filterStageOrders(mapped, stage),
      rowsById: rowMap
    };
  }, [queueRows, stage]);

  const loading = stage === "history" ? historyLoading : queueLoading;

  return { orders, historyOrders, rowsById, counts, loading, error };
}
