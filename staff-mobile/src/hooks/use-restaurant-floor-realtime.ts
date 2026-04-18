import { useEffect, useState } from "react";
import { staffDb } from "../lib/firebase";
import {
  subscribeOrdersRealtime,
  subscribeTablesRealtime,
  type RestaurantTableDoc,
  type TableServiceOrderDoc
} from "../services/restaurantFloorRealtime";

export type UseTablesRealtimeResult = {
  tables: Array<RestaurantTableDoc & { id: string }>;
  loading: boolean;
  error: string | null;
};

/**
 * Realtime listener for the full `tables` collection.
 */
export function useTablesCollectionRealtime(enabled = true): UseTablesRealtimeResult {
  const [tables, setTables] = useState<Array<RestaurantTableDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeTablesRealtime(
      staffDb,
      (next) => {
        setTables(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [enabled]);

  return { tables, loading, error };
}

export type UseOrdersRealtimeResult = {
  orders: TableServiceOrderDoc[];
  loading: boolean;
  error: string | null;
};

/**
 * Realtime listener for recent `orders` (newest first, bounded).
 */
export function useOrdersCollectionRealtime(enabled = true, maxRows = 500): UseOrdersRealtimeResult {
  const [orders, setOrders] = useState<TableServiceOrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeOrdersRealtime(
      staffDb,
      (next) => {
        setOrders(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { maxRows }
    );
    return () => unsub();
  }, [enabled, maxRows]);

  return { orders, loading, error };
}
