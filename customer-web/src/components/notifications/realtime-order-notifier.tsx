"use client";

import { useEffect, useRef } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

function eventTimeMs(data: Record<string, unknown>): number {
  const c = data.createdAt;
  if (c && typeof c === "object" && c !== null && "toMillis" in c && typeof (c as { toMillis?: () => number }).toMillis === "function") {
    return (c as { toMillis: () => number }).toMillis();
  }
  if (typeof c === "string") {
    const t = new Date(c).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

export function RealtimeOrderNotifier() {
  const { showToast } = useToast();
  const lastStatusRef = useRef<string>("");
  const lastOrderIdRef = useRef<string>("");
  const lastEventKeyRef = useRef<string>("");
  const notificationsPrimedRef = useRef(false);

  useEffect(() => {
    const orderId = window.localStorage.getItem("nausheen_last_order_id");
    if (!orderId) return;
    lastOrderIdRef.current = orderId;
    const unsub = onSnapshot(doc(db, "orderFeeds", orderId), (snapshot) => {
      const status = String(snapshot.data()?.status ?? "");
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
    return () => unsub();
  }, [showToast]);

  useEffect(() => {
    const orderId = window.localStorage.getItem("nausheen_last_order_id");
    if (!orderId) return;
    lastOrderIdRef.current = orderId;

    const q = query(collection(db, "customerOrderNotifications"), where("orderId", "==", orderId));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return { id: d.id, ...data } as Record<string, unknown> & { id: string };
      });
      if (docs.length === 0) return;
      docs.sort((a, b) => eventTimeMs(a) - eventTimeMs(b));
      const latest = docs[docs.length - 1];
      if (!latest?.title || !latest?.body) return;
      const latestKey = latest.id;
      if (!notificationsPrimedRef.current) {
        notificationsPrimedRef.current = true;
        lastEventKeyRef.current = latestKey;
        return;
      }
      if (latestKey === lastEventKeyRef.current) return;
      lastEventKeyRef.current = latestKey;
      showToast({
        title: String(latest.title),
        description: String(latest.body)
      });
    });
    return () => unsub();
  }, [showToast]);

  return null;
}
