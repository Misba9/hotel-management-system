"use client";

import { useEffect, useRef, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CustomerOrderListItem } from "@/lib/order-service";
import { USER_ORDERS_LIVE_LIMIT, subscribeToUserOrders } from "@/lib/order-service";
import { useAuth } from "@/context/auth-context";

export type UseCustomerOrdersOptions = {
  /** Last document in the live window (for cursor pagination). */
  onMeta?: (lastVisible: QueryDocumentSnapshot | null) => void;
  /** Max orders in the live snapshot (default {@link USER_ORDERS_LIVE_LIMIT}). */
  maxDocs?: number;
};

export type UseCustomerOrdersResult = {
  orders: CustomerOrderListItem[];
  loading: boolean;
  error: string | null;
};

/**
 * Live Firestore: `orders` where `userId` == `auth.uid`, `orderBy(createdAt desc)`, bounded.
 */
export function useCustomerOrders(options?: UseCustomerOrdersOptions): UseCustomerOrdersResult {
  const { user } = useAuth();
  const maxDocs = options?.maxDocs ?? USER_ORDERS_LIVE_LIMIT;
  const [orders, setOrders] = useState<CustomerOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onMetaRef = useRef(options?.onMeta);
  onMetaRef.current = options?.onMeta;

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = subscribeToUserOrders(db, user.uid, {
      maxDocs,
      onData: (items) => {
        setOrders(items);
        setLoading(false);
        setError(null);
      },
      onMeta: (last) => onMetaRef.current?.(last),
      onError: (msg) => {
        setError(msg);
        setLoading(false);
      }
    });

    return () => unsub();
  }, [user, maxDocs]);

  return { orders, loading, error };
}
