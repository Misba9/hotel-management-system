import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { FirebaseError } from "firebase/app";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { staffDb, staffFunctions } from "../lib/firebase";
import { KitchenOrderCard } from "./kitchen-dashboard/kitchen-order-card";
import type { KitchenOrderRow } from "./kitchen-dashboard/kitchen-types";
import { staffPhysicalAlert } from "../services/notifications.js";

export type { KitchenOrderRow } from "./kitchen-dashboard/kitchen-types";

const KITCHEN_VIEW_STATUSES = new Set([
  "pending",
  "created",
  "confirmed",
  "preparing",
  "accepted",
  "ready"
]);

function createdAtToIso(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as Timestamp).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function mergeLineQuantities(lines: Array<{ name: string; qty: number }>): Array<{ name: string; qty: number }> {
  const map = new Map<string, { name: string; qty: number }>();
  for (const line of lines) {
    const key = line.name.trim().toLowerCase();
    const prev = map.get(key);
    if (prev) prev.qty += line.qty;
    else map.set(key, { name: line.name, qty: line.qty });
  }
  return Array.from(map.values());
}

async function loadLineItems(orderId: string): Promise<Array<{ name: string; qty: number }>> {
  let legacySnap;
  let v1Snap;
  try {
    [legacySnap, v1Snap] = await Promise.all([
      getDocs(query(collection(staffDb, "order_items"), where("orderId", "==", orderId))),
      getDocs(query(collection(staffDb, "orderItems"), where("orderId", "==", orderId)))
    ]);
  } catch {
    return [];
  }
  const lineDocs = [...legacySnap.docs, ...v1Snap.docs];
  const lines = lineDocs.map((entry) => {
    const item = entry.data() as { name?: string; qty?: number; quantity?: number };
    return {
      name: item.name ?? "Item",
      qty: Number(item.qty ?? item.quantity ?? 1)
    };
  });
  return mergeLineQuantities(lines);
}

function embeddedItems(data: Record<string, unknown>): Array<{ name: string; qty: number }> | null {
  const raw = data.items;
  if (!Array.isArray(raw)) return null;
  const out: Array<{ name: string; qty: number }> = [];
  for (const row of raw) {
    if (row && typeof row === "object") {
      const o = row as { name?: string; qty?: number; quantity?: number };
      const name = String(o.name ?? "Item");
      const qty = Number(o.qty ?? o.quantity ?? 1);
      out.push({ name, qty: Number.isFinite(qty) ? qty : 1 });
    }
  }
  return out.length ? out : null;
}

/**
 * Live kitchen KDS: `orders` + `onSnapshot`, line items, sound on new ticket, grid cards, status colors.
 */
export function KitchenOrdersBoard() {
  const { width: windowWidth } = useWindowDimensions();
  const isGrid = windowWidth >= 520;
  const cardBasis: "48.5%" | "100%" = isGrid ? "48.5%" : "100%";

  const [rawDocs, setRawDocs] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [orders, setOrders] = useState<KitchenOrderRow[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "preparing" | "ready">("pending");
  const [loading, setLoading] = useState(true);
  const [listenError, setListenError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());

  const previousKitchenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const q = query(collection(staffDb, "orders"), orderBy("createdAt", "desc"), limit(150));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setListenError(null);
        const next = snapshot.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
        setRawDocs(next);
      },
      (err) => {
        setListenError(err instanceof Error ? err.message : "Failed to listen to orders");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const kitchenRows: KitchenOrderRow[] = [];
      for (const { id, data } of rawDocs) {
        const status = String(data.status ?? "pending");
        if (!KITCHEN_VIEW_STATUSES.has(status.toLowerCase())) continue;

        const embedded = embeddedItems(data);
        const items = embedded ?? (await loadLineItems(id));

        kitchenRows.push({
          orderId: id,
          status,
          type: typeof data.type === "string" ? data.type : typeof data.orderType === "string" ? data.orderType : undefined,
          totalAmount:
            typeof data.totalAmount === "number"
              ? data.totalAmount
              : typeof data.total === "number"
                ? data.total
                : undefined,
          createdAt: createdAtToIso(data.createdAt),
          items
        });
      }

      if (cancelled) return;

      const activeKitchenIds = new Set(
        kitchenRows.filter((o) => o.status === "pending" || o.status === "preparing" || o.status === "accepted").map((o) => o.orderId)
      );
      const prev = previousKitchenIdsRef.current;
      const hadPrev = prev.size > 0;
      const newTicketIds = kitchenRows
        .filter((o) => activeKitchenIds.has(o.orderId) && !prev.has(o.orderId))
        .map((o) => o.orderId);

      if (hadPrev && newTicketIds.length > 0) {
        await staffPhysicalAlert("kitchen_new");
        setHighlightedIds((s) => {
          const next = new Set(s);
          newTicketIds.forEach((id) => next.add(id));
          return next;
        });
      }
      previousKitchenIdsRef.current = activeKitchenIds;

      kitchenRows.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });

      setOrders(kitchenRows);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [rawDocs]);

  useEffect(() => {
    if (highlightedIds.size === 0) return undefined;
    const t = setTimeout(() => setHighlightedIds(new Set()), 12000);
    return () => clearTimeout(t);
  }, [highlightedIds]);

  const updateStatus = useCallback(async (orderId: string, status: "preparing" | "ready") => {
    setUpdatingId(orderId);
    try {
      const callable = httpsCallable(staffFunctions, "updateOrderStatusV1");
      await callable({ orderId, status });
      setHighlightedIds((s) => {
        const next = new Set(s);
        next.delete(orderId);
        return next;
      });
    } catch (e) {
      const msg =
        e instanceof FirebaseError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Update failed";
      Alert.alert("Could not update order", msg);
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const pendingOrders = useMemo(
    () => orders.filter((o) => ["pending", "created", "confirmed", "accepted"].includes(o.status.toLowerCase())),
    [orders]
  );
  const preparingOrders = useMemo(() => orders.filter((o) => o.status.toLowerCase() === "preparing"), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === "ready"), [orders]);
  const visibleOrders = activeTab === "pending" ? pendingOrders : activeTab === "preparing" ? preparingOrders : readyOrders;

  function minutesSinceOrder(createdAt?: string) {
    if (!createdAt) return "Just now";
    const ms = Date.now() - new Date(createdAt).getTime();
    if (Number.isNaN(ms) || ms < 45_000) return "Just now";
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}h ${rem}m ago`;
  }

  if (listenError) {
    return (
      <View style={{ borderRadius: 12, backgroundColor: "#FEF2F2", padding: 16, borderWidth: 1, borderColor: "#FECACA" }}>
        <Text style={{ color: "#991B1B", fontWeight: "700" }}>{listenError}</Text>
        <Text style={{ color: "#64748b", marginTop: 8, fontSize: 12 }}>
          Ensure Firestore has a single-field index on `orders.createdAt` and documents use a consistent `createdAt` (string or timestamp).
        </Text>
      </View>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <View style={{ borderRadius: 12, backgroundColor: "white", padding: 24, alignItems: "center" }}>
        <ActivityIndicator color="#FF6B35" />
        <Text style={{ marginTop: 10, color: "#64748b" }}>Syncing live orders…</Text>
      </View>
    );
  }

  return (
    <View>
      <View
        style={{
          borderRadius: 16,
          backgroundColor: "white",
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: "#e2e8f0"
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#0f172a" }}>Live orders</Text>
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>🔔 New tickets play a chime • Yellow / orange / green by stage</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(
              [
                { key: "pending" as const, label: "🟡 New", sub: "Pending", count: pendingOrders.length },
                { key: "preparing" as const, label: "🟠 Cooking", sub: "Preparing", count: preparingOrders.length },
                { key: "ready" as const, label: "🟢 Pickup", sub: "Ready", count: readyOrders.length }
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: active ? "#FF6B35" : "#f1f5f9",
                    borderWidth: active ? 0 : 1,
                    borderColor: "#e2e8f0",
                    minWidth: 112
                  }}
                >
                  <Text style={{ color: active ? "white" : "#0f172a", fontWeight: "900", fontSize: 13 }}>{tab.label}</Text>
                  <Text style={{ color: active ? "rgba(255,255,255,0.9)" : "#64748b", fontSize: 11, marginTop: 2 }}>
                    {tab.sub} · {tab.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {visibleOrders.length === 0 ? (
        <View style={{ borderRadius: 14, backgroundColor: "white", padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 36 }}>🍳</Text>
          <Text style={{ color: "#64748b", fontSize: 14, marginTop: 8, textAlign: "center" }}>No orders in this column.</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 0 }}>
          {visibleOrders.map((order) => {
            const busy = updatingId === order.orderId;
            const s = order.status.toLowerCase();
            const showStart = ["pending", "created", "confirmed", "accepted"].includes(s);
            const showReady = s === "preparing";

            return (
              <View key={order.orderId} style={{ width: cardBasis, marginBottom: 12 }}>
                <KitchenOrderCard
                  order={order}
                  relativeTime={minutesSinceOrder(order.createdAt)}
                  highlighted={highlightedIds.has(order.orderId)}
                  busy={busy}
                  showStart={showStart}
                  showReady={showReady}
                  onStartPrep={() => void updateStatus(order.orderId, "preparing")}
                  onMarkReady={() => void updateStatus(order.orderId, "ready")}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
