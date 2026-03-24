"use client";

import { useEffect, useRef } from "react";
import { onValue, ref } from "firebase/database";
import { rtdb } from "@shared/firebase/client";
import { useToast } from "@/components/providers/toast-provider";

const STATUS_LABELS: Record<string, { title: string; description: string }> = {
  pending: { title: "Order placed", description: "Your order has been placed successfully." },
  created: { title: "Order placed", description: "Your order has been placed successfully." },
  confirmed: { title: "Order accepted", description: "The store accepted your order." },
  preparing: { title: "Order accepted", description: "Kitchen started preparing your order." },
  ready: { title: "Order ready", description: "Your order is ready for dispatch." },
  out_for_delivery: { title: "Out for delivery", description: "Your rider is on the way." },
  delivered: { title: "Delivered", description: "Order delivered successfully." }
};

export function RealtimeOrderNotifier() {
  const { showToast } = useToast();
  const lastStatusRef = useRef<string>("");
  const lastOrderIdRef = useRef<string>("");
  const lastEventKeyRef = useRef<string>("");

  useEffect(() => {
    const orderId = window.localStorage.getItem("nausheen_last_order_id");
    if (!orderId) return;
    lastOrderIdRef.current = orderId;
    const statusRef = ref(rtdb, `orderFeeds/${orderId}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const status = String(snapshot.val()?.status ?? "");
      if (!status || status === lastStatusRef.current) return;
      const labels = STATUS_LABELS[status];
      if (!labels) return;
      if (lastStatusRef.current !== "") {
        showToast({
          title: labels.title,
          description: labels.description
        });
      }
      lastStatusRef.current = status;
    });
    return () => unsubscribe();
  }, [showToast]);

  useEffect(() => {
    const orderNotificationsRoot = ref(rtdb, "notifications/customers/orders");
    const unsubscribe = onValue(orderNotificationsRoot, (snapshot) => {
      const payload = (snapshot.val() ?? {}) as Record<
        string,
        Record<string, { orderId?: string; title?: string; body?: string }>
      >;
      if (!lastOrderIdRef.current) return;
      const orderEvents = payload[lastOrderIdRef.current];
      if (!orderEvents) return;
      const eventKeys = Object.keys(orderEvents);
      if (eventKeys.length === 0) return;
      const latestEventKey = eventKeys[eventKeys.length - 1];
      if (latestEventKey === lastEventKeyRef.current) return;
      const latestEvent = orderEvents[latestEventKey];
      if (!latestEvent?.title || !latestEvent?.body) return;
      lastEventKeyRef.current = latestEventKey;
      showToast({
        title: latestEvent.title,
        description: latestEvent.body
      });
    });
    return () => unsubscribe();
  }, [showToast]);

  return null;
}
