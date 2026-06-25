import { useEffect, useState } from "react";
import {
  subscribeKitchenNewOrders,
  subscribeKitchenPreparingOrders,
  subscribeKitchenReadyOrders
} from "@/services/orders";

export type KitchenNavCounts = {
  active: number;
  ready: number;
};

export function useKitchenNavCounts(enabled = true): KitchenNavCounts {
  const [counts, setCounts] = useState<KitchenNavCounts>({ active: 0, ready: 0 });

  useEffect(() => {
    if (!enabled) {
      setCounts({ active: 0, ready: 0 });
      return;
    }

    let newCount = 0;
    let preparingCount = 0;

    const syncActive = () => {
      setCounts((prev) => ({ ...prev, active: newCount + preparingCount }));
    };

    const unsubs = [
      subscribeKitchenNewOrders((rows) => {
        newCount = rows.length;
        syncActive();
      }),
      subscribeKitchenPreparingOrders((rows) => {
        preparingCount = rows.length;
        syncActive();
      }),
      subscribeKitchenReadyOrders((rows) => {
        setCounts((prev) => ({ ...prev, ready: rows.length }));
      })
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [enabled]);

  return counts;
}
