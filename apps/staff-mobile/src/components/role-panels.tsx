import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import { ref, onValue, query as rtdbQuery, limitToLast, orderByKey } from "firebase/database";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { staffDb, staffFunctions, staffRtdb } from "../lib/firebase";

function Card({ text }: { text: string }) {
  return (
    <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
      <Text>{text}</Text>
    </View>
  );
}

export function DeliveryPanel() {
  return (
    <View>
      <Card text="Accept / Reject order requests" />
      <Card text="Navigate with Google Maps to customer location" />
      <Card text="Update status: Picked up -> Delivered" />
      <Card text="Daily earnings summary" />
    </View>
  );
}

export function KitchenPanel() {
  const [orders, setOrders] = useState<
    Array<{
      orderId: string;
      status: "created" | "confirmed" | "pending" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
      updatedAt: string;
      priorityScore: number;
      orderType?: string;
      total?: number;
      createdAt?: string;
      note?: string;
    }>
  >([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderItemsById, setOrderItemsById] = useState<Record<string, Array<{ name: string; quantity: number }>>>({});
  const [inventory, setInventory] = useState<Array<{ id: string; ingredientName: string; currentStock: number; minStock: number }>>([]);
  const [displayMode, setDisplayMode] = useState<"normal" | "kds">("normal");
  const [latestStaffAlert, setLatestStaffAlert] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const previousPendingCount = useRef(0);
  const lastStaffEventKey = useRef<string>("");

  useEffect(() => {
    const orderFeedRef = ref(staffRtdb, "orderFeeds");
    const stopListening = onValue(orderFeedRef, async (snapshot) => {
      const payload = (snapshot.val() ?? {}) as Record<
        string,
        {
          status?: "created" | "confirmed" | "pending" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
          updatedAt?: string;
        }
      >;

      const entries = Object.entries(payload);

      const hydrated = await Promise.all(
        entries.map(async ([orderId, value]) => {
          const orderDoc = await getDoc(doc(staffDb, "orders", orderId));
          const orderData = orderDoc.exists()
            ? (orderDoc.data() as { createdAt?: string; orderType?: string; total?: number; notes?: string })
            : {};

          const createdAtMs = orderData.createdAt ? new Date(orderData.createdAt).getTime() : Date.now();
          const ageMinutes = Math.max(0, (Date.now() - createdAtMs) / 60000);
          const basePriority =
            value.status === "pending" || value.status === "created"
              ? 60
              : value.status === "confirmed"
                ? 55
                : value.status === "preparing"
                  ? 35
                  : value.status === "ready"
                    ? 25
                    : value.status === "out_for_delivery"
                      ? 10
                      : 0;
          const priorityScore =
            basePriority +
            (orderData.orderType === "delivery" ? 20 : 0) +
            Math.min(40, Math.floor(ageMinutes));

          return {
            orderId,
            status: (value.status as "created" | "confirmed" | "pending" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled") ?? "pending",
            updatedAt: value.updatedAt ?? new Date().toISOString(),
            priorityScore,
            orderType: orderData.orderType ?? "delivery",
            total: orderData.total ?? 0,
            createdAt: orderData.createdAt,
            note: orderData.notes ?? ""
          };
        })
      );

      const sorted = hydrated.sort((a, b) => b.priorityScore - a.priorityScore);
      const pendingCount = sorted.filter((order) => order.status === "pending" || order.status === "created").length;

      if (pendingCount > previousPendingCount.current) {
        await playKitchenAlertSound();
      }
      previousPendingCount.current = pendingCount;

      setOrders(sorted);
      setLoading(false);
    });

    return () => stopListening();
  }, []);

  useEffect(() => {
    const newOrderEventsRef = rtdbQuery(ref(staffRtdb, "notifications/staff/newOrders"), orderByKey(), limitToLast(1));
    const stop = onValue(newOrderEventsRef, async (snapshot) => {
      const payload = (snapshot.val() ?? {}) as Record<string, { orderId?: string; total?: number }>;
      const keys = Object.keys(payload);
      if (keys.length === 0) return;
      const latestKey = keys[0];
      if (!latestKey || latestKey === lastStaffEventKey.current) return;
      lastStaffEventKey.current = latestKey;
      const event = payload[latestKey];
      setLatestStaffAlert(`New order received: ${event.orderId ?? "Unknown"}`);
      await playKitchenAlertSound();
    });
    return () => stop();
  }, []);

  useEffect(() => {
    async function loadInventory() {
      const snap = await getDocs(collection(staffDb, "inventory"));
      const items = snap.docs.map((entry) => {
        const data = entry.data() as { ingredientName?: string; currentStock?: number; minStock?: number };
        return {
          id: entry.id,
          ingredientName: data.ingredientName ?? entry.id,
          currentStock: Number(data.currentStock ?? 0),
          minStock: Number(data.minStock ?? 0)
        };
      });
      setInventory(items);
    }
    void loadInventory();
  }, []);

  async function fetchOrderItems(orderId: string) {
    const cacheHit = orderItemsById[orderId];
    if (cacheHit) return;
    const q = query(collection(staffDb, "order_items"), where("orderId", "==", orderId));
    const snap = await getDocs(q);
    const items = snap.docs.map((entry) => {
      const data = entry.data() as { name?: string; qty?: number; quantity?: number };
      return {
        name: data.name ?? "Item",
        quantity: Number(data.qty ?? data.quantity ?? 1)
      };
    });
    setOrderItemsById((prev) => ({ ...prev, [orderId]: items }));
  }

  async function updateKitchenOrder(
    orderId: string,
    status: "confirmed" | "preparing" | "ready" | "delivered"
  ) {
    try {
      const callable = httpsCallable(staffFunctions, "updateOrderStatusV1");
      await callable({ orderId, status });
    } catch (error) {
      try {
        if (status === "preparing" || status === "ready") {
          const fallbackCallable = httpsCallable(staffFunctions, "updateKitchenStatus");
          await fallbackCallable({ orderId, status });
        } else {
          console.error("Kitchen status update failed:", error);
        }
      } catch (fallbackError) {
        console.error("Kitchen status fallback failed:", fallbackError);
      }
    }
  }

  const incomingOrders = useMemo(
    () => orders.filter((order) => order.status === "pending" || order.status === "created" || order.status === "confirmed"),
    [orders]
  );
  const preparingOrders = useMemo(() => orders.filter((order) => order.status === "preparing"), [orders]);
  const readyOrders = useMemo(() => orders.filter((order) => order.status === "ready"), [orders]);
  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === "delivered" || order.status === "out_for_delivery" || order.status === "cancelled"),
    [orders]
  );

  const selectedOrder = useMemo(() => orders.find((order) => order.orderId === selectedOrderId) ?? null, [orders, selectedOrderId]);
  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.currentStock <= item.minStock),
    [inventory]
  );

  return (
    <View>
      <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
        <Text style={{ fontWeight: "700", marginBottom: 4 }}>Live Kitchen Queue</Text>
        <Text style={{ color: "#64748b", fontSize: 12 }}>
          {orders.length} active orders • real-time updates • auto refresh enabled
        </Text>
        {latestStaffAlert ? (
          <View style={{ marginTop: 8, borderRadius: 8, backgroundColor: "#fff7ed", paddingHorizontal: 10, paddingVertical: 8 }}>
            <Text style={{ color: "#c2410c", fontWeight: "700", fontSize: 12 }}>{latestStaffAlert}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            onPress={() => setDisplayMode("normal")}
            style={{
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 12,
              backgroundColor: displayMode === "normal" ? "#FF6B35" : "#e2e8f0"
            }}
          >
            <Text style={{ color: displayMode === "normal" ? "white" : "#334155", fontWeight: "600", fontSize: 12 }}>Normal Mode</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDisplayMode("kds")}
            style={{
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 12,
              backgroundColor: displayMode === "kds" ? "#0f172a" : "#e2e8f0"
            }}
          >
            <Text style={{ color: displayMode === "kds" ? "white" : "#334155", fontWeight: "600", fontSize: 12 }}>Kitchen Display Mode</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 20 }}>
          <ActivityIndicator color="#FF6B35" />
          <Text style={{ marginTop: 8, color: "#64748b" }}>Loading queue...</Text>
        </View>
      ) : (
        <View>
          <OrderBoardColumn
            title="Incoming Orders"
            count={incomingOrders.length}
            orders={incomingOrders}
            onSelect={async (orderId) => {
              setSelectedOrderId(orderId);
              await fetchOrderItems(orderId);
            }}
            displayMode={displayMode}
            color="#FF6B35"
          />
          <OrderBoardColumn
            title="Preparing Orders"
            count={preparingOrders.length}
            orders={preparingOrders}
            onSelect={async (orderId) => {
              setSelectedOrderId(orderId);
              await fetchOrderItems(orderId);
            }}
            displayMode={displayMode}
            color="#0EA5E9"
          />
          <OrderBoardColumn
            title="Ready Orders"
            count={readyOrders.length}
            orders={readyOrders}
            onSelect={async (orderId) => {
              setSelectedOrderId(orderId);
              await fetchOrderItems(orderId);
            }}
            displayMode={displayMode}
            color="#16A34A"
          />
          <OrderBoardColumn
            title="Completed Orders"
            count={completedOrders.length}
            orders={completedOrders}
            onSelect={async (orderId) => {
              setSelectedOrderId(orderId);
              await fetchOrderItems(orderId);
            }}
            displayMode={displayMode}
            color="#334155"
          />

          {selectedOrder ? (
            <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#f1f5f9" }}>
              <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 4 }}>Order View: {selectedOrder.orderId}</Text>
              <Text style={{ fontSize: 12, color: "#64748b" }}>
                Type: {selectedOrder.orderType} • Amount: Rs. {selectedOrder.total ?? 0} • Status: {selectedOrder.status}
              </Text>
              <Text style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Special notes: {selectedOrder.note?.trim() ? selectedOrder.note : "None"}
              </Text>

              <View style={{ marginTop: 10 }}>
                <Text style={{ fontWeight: "600", marginBottom: 6 }}>Items</Text>
                {(orderItemsById[selectedOrder.orderId] ?? []).length === 0 ? (
                  <Text style={{ color: "#64748b", fontSize: 12 }}>No items found for this order.</Text>
                ) : (
                  (orderItemsById[selectedOrder.orderId] ?? []).map((item, idx) => (
                    <Text key={`${selectedOrder.orderId}-${idx}`} style={{ color: "#334155", marginBottom: 2 }}>
                      • {item.name} x{item.quantity}
                    </Text>
                  ))
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <StatusButton
                    label="Accept"
                    color="#475569"
                    onPress={() => updateKitchenOrder(selectedOrder.orderId, "confirmed")}
                  />
                  <StatusButton
                    label="Preparing"
                    color="#0EA5E9"
                    onPress={() => updateKitchenOrder(selectedOrder.orderId, "preparing")}
                  />
                  <StatusButton
                    label="Ready"
                    color="#16A34A"
                    onPress={() => updateKitchenOrder(selectedOrder.orderId, "ready")}
                  />
                  <StatusButton
                    label="Completed"
                    color="#334155"
                    onPress={() => updateKitchenOrder(selectedOrder.orderId, "delivered")}
                  />
                </View>
              </ScrollView>
            </View>
          ) : null}

          <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
            <Text style={{ fontWeight: "700", marginBottom: 6 }}>Inventory Snapshot</Text>
            {inventory.length === 0 ? (
              <Text style={{ color: "#64748b", fontSize: 12 }}>Inventory data not available.</Text>
            ) : (
              inventory.slice(0, displayMode === "kds" ? 10 : 6).map((item) => {
                const low = item.currentStock <= item.minStock;
                return (
                  <View
                    key={item.id}
                    style={{
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: low ? "#fecaca" : "#e2e8f0",
                      backgroundColor: low ? "#fef2f2" : "#f8fafc",
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      marginBottom: 6
                    }}
                  >
                    <Text style={{ fontWeight: "600", color: "#0f172a" }}>{item.ingredientName}</Text>
                    <Text style={{ fontSize: 12, color: "#64748b" }}>
                      Stock: {item.currentStock} • Min: {item.minStock} {low ? "• LOW STOCK" : ""}
                    </Text>
                  </View>
                );
              })
            )}
            {lowStockItems.length > 0 ? (
              <Text style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: "600" }}>
                Alert: {lowStockItems.length} ingredients are below minimum stock.
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

function StatusButton({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: color
      }}
    >
      <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function OrderBoardColumn({
  title,
  count,
  orders,
  onSelect,
  displayMode,
  color
}: {
  title: string;
  count: number;
  orders: Array<{
    orderId: string;
    status: string;
    total?: number;
    orderType?: string;
    priorityScore: number;
    updatedAt: string;
  }>;
  onSelect: (orderId: string) => void | Promise<void>;
  displayMode: "normal" | "kds";
  color: string;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontWeight: "700", fontSize: displayMode === "kds" ? 18 : 15 }}>{title}</Text>
        <View style={{ borderRadius: 999, backgroundColor: color, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>{count}</Text>
        </View>
      </View>
      {orders.length === 0 ? (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 12 }}>
          <Text style={{ color: "#64748b", fontSize: 12 }}>No orders</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {orders.map((order) => (
              <TouchableOpacity
                key={order.orderId}
                onPress={() => {
                  void onSelect(order.orderId);
                }}
                style={{
                  borderRadius: 12,
                  backgroundColor: "white",
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  width: displayMode === "kds" ? 260 : 220,
                  padding: displayMode === "kds" ? 14 : 12
                }}
              >
                <Text style={{ fontWeight: "700", fontSize: displayMode === "kds" ? 18 : 15 }}>{order.orderId}</Text>
                <Text style={{ color: "#64748b", marginTop: 4, fontSize: displayMode === "kds" ? 14 : 12 }}>
                  {order.orderType} • Rs. {order.total ?? 0}
                </Text>
                <Text style={{ color: "#64748b", marginTop: 2, fontSize: displayMode === "kds" ? 14 : 12 }}>
                  Priority {order.priorityScore}
                </Text>
                <Text style={{ color: "#94a3b8", marginTop: 2, fontSize: 11 }}>Updated {new Date(order.updatedAt).toLocaleTimeString()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export function WaiterPanel() {
  return (
    <View>
      <Card text="Create table orders quickly" />
      <Card text="Send order to kitchen in one tap" />
      <Card text="Track table order status" />
    </View>
  );
}

export function CashierPanel() {
  return (
    <View>
      <Card text="Fast POS quick menu buttons" />
      <Card text="Collect cash / UPI payment" />
      <Card text="Print customer receipt" />
    </View>
  );
}

export function ManagerPanel() {
  return (
    <View>
      <Card text="Monitor branch orders and fulfillment" />
      <Card text="Track staff performance and issue alerts" />
      <Card text="View daily and monthly reports" />
    </View>
  );
}

async function playKitchenAlertSound() {
  try {
    const sound = new Audio.Sound();
    await sound.loadAsync({
      uri: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
    });
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch (error) {
    console.error("Unable to play kitchen alert sound:", error);
  }
}
