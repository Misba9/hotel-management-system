import { useEffect, useRef } from "react";
import type { StaffOrderRow } from "@/services/orders";
import { resolveOrderSource } from "@/lib/pos/order-source";
import {
  orderBelongsToPlatform,
  orderDisplayId,
  resolveWorkflowStatus
} from "@/lib/pos/order-workflow-status";
import type { PlatformTab } from "@/lib/pos/cashier-pos-store";
import { playNewOrderSound } from "@/lib/kds-utils";
import { getDesktopApi, isDesktopRuntime } from "@/lib/desktop-api";

const ALERT_PLATFORMS = new Set(["swiggy", "zomato", "online", "waiter"]);

/** Detect new channel orders and fire sound + toast for cashier. */
export function useChannelOrderAlerts(
  orders: StaffOrderRow[],
  onToast: (msg: string, type?: "info" | "success" | "error") => void,
  enabled = true
) {
  const knownIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const channelOrders = orders.filter((o) => {
      const src = resolveOrderSource(o);
      return ALERT_PLATFORMS.has(src) || o.orderType === "dine_in";
    });

    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      knownIdsRef.current = new Set(channelOrders.map((o) => o.id));
      return;
    }

    for (const order of channelOrders) {
      if (knownIdsRef.current.has(order.id)) continue;
      if (resolveWorkflowStatus(order) !== "new") continue;

      knownIdsRef.current.add(order.id);
      const src = resolveOrderSource(order);
      const label =
        src === "swiggy"
          ? "Swiggy"
          : src === "zomato"
            ? "Zomato"
            : src === "waiter" || order.orderType === "dine_in"
              ? "Waiter"
              : "Online";

      onToast(`New ${label} order ${orderDisplayId(order)} received`, "info");

      const play = () => {
        if (isDesktopRuntime()) {
          void getDesktopApi()
            .getSettings()
            .then((s) => {
              if (s.soundNotifications) playNewOrderSound();
            })
            .catch(() => playNewOrderSound());
        } else {
          playNewOrderSound();
        }
      };
      play();
    }

    knownIdsRef.current = new Set(channelOrders.map((o) => o.id));
  }, [orders, enabled, onToast]);
}

export function countNewOrdersForPlatform(orders: StaffOrderRow[], platform: PlatformTab): number {
  return orders.filter(
    (o) => orderBelongsToPlatform(o, platform) && resolveWorkflowStatus(o) === "new"
  ).length;
}
