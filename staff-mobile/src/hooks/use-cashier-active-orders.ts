import { useEffect, useState } from "react";
import { subscribeRecentOrders, type StaffOrderRow } from "../../services/orders";

export function useCashierActiveOrders(enabled = true) {
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeRecentOrders(
      (list) => {
        setOrders(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setOrders([]);
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not load orders.");
      }
    );
    return unsub;
  }, [enabled]);

  return { orders, loading, error };
}
