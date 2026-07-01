import { useEffect, useState } from "react";
import type { CustomerOrderListItem } from "@/src/lib/order-service";
import { subscribeToUserOrders } from "@/src/lib/order-service";
import { db } from "@/src/services/firebase";

export function useCustomerOrders(userId: string | null | undefined) {
  const [orders, setOrders] = useState<CustomerOrderListItem[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToUserOrders(db, userId, {
      onData: (list) => {
        setOrders(list);
        setLoading(false);
        setError(null);
      },
      onError: (msg) => {
        setError(msg);
        setLoading(false);
      }
    });

    return unsub;
  }, [userId]);

  return { orders, loading, error };
}
