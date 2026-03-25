import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TouchableOpacity, TextInput, View } from "react-native";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import { ref, onValue, query as rtdbQuery, limitToLast, orderByKey } from "firebase/database";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { staffDb, staffFunctions, staffRtdb } from "../lib/firebase";
import { useStaffAuth } from "../context/staff-auth-context";

function Card({ text }: { text: string }) {
  return (
    <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
      <Text>{text}</Text>
    </View>
  );
}

export function DeliveryPanel() {
  const { user } = useStaffAuth();
  const uid = user?.uid ?? "";

  type DeliveryTrackingValue = {
    deliveryId?: string;
    assignmentId?: string;
    deliveryPartnerId?: string;
    deliveryBoyId?: string;
    status?: "assigned" | "picked_up" | "on_the_way" | "delivered" | "failed" | string;
    updatedAt?: string;
  };

  const [trackingByOrderId, setTrackingByOrderId] = useState<Record<string, DeliveryTrackingValue>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderById, setOrderById] = useState<
    Record<string, { orderType?: string; total?: number; deliveryAddress?: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const sharingSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const assignmentIdRef = useRef<string | null>(null);

  useEffect(() => {
    const deliveryTrackingRef = ref(staffRtdb, "deliveryTracking");
    const stopListening = onValue(deliveryTrackingRef, (snapshot) => {
      const payload = (snapshot.val() ?? {}) as Record<string, DeliveryTrackingValue>;
      setTrackingByOrderId(payload);
      setLoading(false);
    });

    return () => stopListening();
  }, []);

  const myDeliveries = useMemo(() => {
    if (!uid) return [];
    return Object.entries(trackingByOrderId)
      .map(([orderId, value]) => ({
        orderId,
        ...value,
        updatedAtMs: value.updatedAt ? new Date(value.updatedAt).getTime() : 0
      }))
      .filter((x) => x.deliveryPartnerId === uid || x.deliveryBoyId === uid)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [trackingByOrderId, uid]);

  const selectedTracking = useMemo(() => {
    if (!selectedOrderId) return null;
    return myDeliveries.find((d) => d.orderId === selectedOrderId) ?? null;
  }, [myDeliveries, selectedOrderId]);

  useEffect(() => {
    assignmentIdRef.current = selectedTracking?.assignmentId ?? null;
  }, [selectedTracking]);

  async function sendLocationUpdate(lat: number, lng: number) {
    const assignmentId = assignmentIdRef.current;
    if (!assignmentId) return;

    const now = Date.now();
    if (now - lastSentAtRef.current < 8000) return; // basic throttle
    lastSentAtRef.current = now;

    try {
      const callable = httpsCallable(staffFunctions, "updateDeliveryAssignmentTrackingV1");
      await callable({
        assignmentId,
        location: { lat, lng }
      });
    } catch (error) {
      console.error("Location sharing failed:", error);
      setSharingError("Location sharing failed. Retrying later…");
    }
  }

  async function startSharingLocation() {
    setSharingError(null);
    if (sharingEnabled) return;
    if (!assignmentIdRef.current) {
      setSharingError("No assignment found for this order yet.");
      return;
    }

    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      setSharingError("Location permission denied.");
      return;
    }

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10
      },
      (pos) => {
        void sendLocationUpdate(pos.coords.latitude, pos.coords.longitude);
      }
    );
    sharingSubRef.current = sub;
    setSharingEnabled(true);
  }

  async function stopSharingLocation() {
    if (sharingSubRef.current) {
      sharingSubRef.current.remove();
      sharingSubRef.current = null;
    }
    setSharingEnabled(false);
  }

  useEffect(() => {
    return () => {
      void stopSharingLocation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedOrderId) return;
    if (orderById[selectedOrderId]) return;
    void (async () => {
      const orderSnap = await getDoc(doc(staffDb, "orders", selectedOrderId));
      const orderData = orderSnap.exists()
        ? (orderSnap.data() as { orderType?: string; total?: number; deliveryAddress?: string | null })
        : {};
      setOrderById((prev) => ({ ...prev, [selectedOrderId]: orderData }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId]);

  async function updateDeliveryStatus(orderId: string, status: "picked_up" | "delivered") {
    const value = trackingByOrderId[orderId];
    if (!value) return;

    try {
      if (value.deliveryId) {
        const callable = httpsCallable(staffFunctions, "updateDeliveryStatusV1");
        await callable({ deliveryId: value.deliveryId, status });
        return;
      }

      if (value.assignmentId) {
        const callable = httpsCallable(staffFunctions, "updateDeliveryStatus");
        await callable({ assignmentId: value.assignmentId, status });
      }
    } catch (error) {
      console.error("Delivery status update failed:", error);
    }
  }

  const selectedOrder = selectedOrderId ? orderById[selectedOrderId] : null;

  return (
    <View>
      <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
        <Text style={{ fontWeight: "700", marginBottom: 4 }}>Your Delivery Queue</Text>
        <Text style={{ color: "#64748b", fontSize: 12 }}>
          {uid ? "Real-time tracking • auto updates" : "Sign in again to view deliveries"}
        </Text>
      </View>

      {loading ? (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 20 }}>
          <ActivityIndicator color="#FF6B35" />
          <Text style={{ marginTop: 8, color: "#64748b" }}>Loading deliveries…</Text>
        </View>
      ) : myDeliveries.length === 0 ? (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 12 }}>
          <Text style={{ color: "#64748b", fontSize: 12 }}>No assigned deliveries right now.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {myDeliveries.map((d) => {
              const isSelected = d.orderId === selectedOrderId;
              const status = d.status ?? "assigned";
              return (
                <TouchableOpacity
                  key={d.orderId}
                  onPress={() => setSelectedOrderId(d.orderId)}
                  style={{
                    borderRadius: 12,
                    backgroundColor: isSelected ? "#FF6B35" : "white",
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                    width: 210,
                    padding: 12
                  }}
                >
                  <Text style={{ fontWeight: "800", fontSize: 14, color: isSelected ? "white" : "#0f172a" }}>{d.orderId}</Text>
                  <Text style={{ marginTop: 6, color: isSelected ? "white" : "#64748b", fontSize: 12 }}>
                    Status: {status.replace(/_/g, " ")}
                  </Text>
                  <Text style={{ marginTop: 2, color: isSelected ? "rgba(255,255,255,0.85)" : "#94a3b8", fontSize: 11 }}>
                    Updated {d.updatedAt ? new Date(d.updatedAt).toLocaleTimeString() : "—"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {selectedTracking && selectedOrder ? (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, borderWidth: 1, borderColor: "#f1f5f9" }}>
          <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 4 }}>Delivery Order: {selectedTracking.orderId}</Text>
          <Text style={{ fontSize: 12, color: "#64748b" }}>
            Type: {selectedOrder.orderType ?? "delivery"} • Amount: Rs. {selectedOrder.total ?? 0}
          </Text>
          {selectedOrder.deliveryAddress ? (
            <Text style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Destination: {selectedOrder.deliveryAddress}
            </Text>
          ) : null}
          <Text style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            Current: {String(selectedTracking.status ?? "assigned").replace(/_/g, " ")}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {selectedTracking.status === "assigned" ? (
              <StatusButton label="Picked up" color="#0EA5E9" onPress={() => updateDeliveryStatus(selectedTracking.orderId, "picked_up")} />
            ) : null}

            {selectedTracking.status === "picked_up" || selectedTracking.status === "on_the_way" ? (
              <StatusButton label="Delivered" color="#16A34A" onPress={() => updateDeliveryStatus(selectedTracking.orderId, "delivered")} />
            ) : null}

            {selectedTracking.status === "delivered" ? (
              <View style={{ borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#e2e8f0" }}>
                <Text style={{ color: "#334155", fontWeight: "700", fontSize: 12 }}>Completed</Text>
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  const dest = selectedOrder.deliveryAddress?.trim();
                  if (!dest) {
                    Alert.alert("Destination missing", "Delivery address is not available for this order.");
                    return;
                  }
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
                  void Linking.openURL(url);
                }}
                style={{
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: "#334155"
                }}
              >
                <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>Open Maps</Text>
              </TouchableOpacity>

              {sharingEnabled ? (
                <TouchableOpacity
                  onPress={() => void stopSharingLocation()}
                  style={{
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: "#dc2626"
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>Stop Sharing</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => void startSharingLocation()}
                  style={{
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: "#0EA5E9"
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>Share Location</Text>
                </TouchableOpacity>
              )}
            </View>

            {sharingError ? (
              <Text style={{ marginTop: 8, color: "#dc2626", fontSize: 12, fontWeight: "700" }}>{sharingError}</Text>
            ) : (
              <Text style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                {sharingEnabled ? "Sharing live location with customer…" : "Tap Share Location to start realtime updates."}
              </Text>
            )}
          </View>
        </View>
      ) : null}
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
    const q = query(collection(staffDb, "orderItems"), where("orderId", "==", orderId));
    const snap = await getDocs(q);
    const items = snap.docs.map((entry) => {
      const data = entry.data() as { name?: string; quantity?: number };
      return {
        name: data.name ?? "Item",
        quantity: Number(data.quantity ?? 1)
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
  const { user } = useStaffAuth();
  const uid = user?.uid ?? "";

  const [branchId, setBranchId] = useState<string>("");

  const [tableNumber, setTableNumber] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "online">("cash");

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  type CartLine = { name: string; price: number; quantity: number };
  const [cart, setCart] = useState<Record<string, CartLine>>({});

  const cartLines = useMemo(
    () =>
      Object.entries(cart).map(([productId, line]) => ({
        productId,
        ...line
      })),
    [cart]
  );

  const cartTotal = useMemo(() => cartLines.reduce((sum, l) => sum + l.price * l.quantity, 0), [cartLines]);

  const [orders, setOrders] = useState<
    Array<{
      orderId: string;
      status: "created" | "confirmed" | "pending" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
      updatedAt: string;
      priorityScore: number;
      orderType?: string;
      total?: number;
      note?: string;
    }>
  >([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderItemsById, setOrderItemsById] = useState<Record<string, Array<{ name: string; quantity: number }>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    void (async () => {
      try {
        const snap = await getDoc(doc(staffDb, "users", uid));
        if (snap.exists()) {
          const data = snap.data() as { branchId?: string };
          setBranchId(String(data.branchId ?? ""));
        }
      } catch (e) {
        console.error("Failed loading staff profile:", e);
      }
    })();
  }, [uid]);

  useEffect(() => {
    // Menu categories for cart building.
    void (async () => {
      setMenuLoading(true);
      try {
        const catsSnap = await getDocs(collection(staffDb, "categories"));
        const cats = catsSnap.docs
          .map((d) => {
            const data = d.data() as { name?: string; active?: boolean };
            return {
              id: d.id,
              name: String(data.name ?? "")
            };
          })
          .filter((c) => c.id && c.name);
        setCategories(cats);
        if (!selectedCategoryId && cats.length > 0) {
          setSelectedCategoryId(cats[0].id);
        }
      } catch (e) {
        console.error("Failed loading categories:", e);
        Alert.alert("Menu error", "Unable to load categories.");
      } finally {
        setMenuLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Products for the selected category.
    if (!selectedCategoryId) return;
    setMenuLoading(true);
    void (async () => {
      try {
        const q = query(
          collection(staffDb, "products"),
          where("categoryId", "==", selectedCategoryId),
          where("available", "==", true)
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => {
          const data = d.data() as { name?: string; price?: number };
          return {
            id: d.id,
            name: String(data.name ?? ""),
            price: Number(data.price ?? 0)
          };
        });
        setProducts(items);
      } catch (e) {
        console.error("Failed loading products:", e);
        Alert.alert("Menu error", "Unable to load items for this category.");
      } finally {
        setMenuLoading(false);
      }
    })();
  }, [selectedCategoryId]);

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

          return {
            orderId,
            status: (value.status as any) ?? "pending",
            updatedAt: value.updatedAt ?? new Date().toISOString(),
            priorityScore: basePriority + Math.min(40, Math.floor(ageMinutes)),
            orderType: orderData.orderType ?? "dine_in",
            total: orderData.total ?? 0,
            note: orderData.notes ?? ""
          };
        })
      );

      const sorted = hydrated.sort((a, b) => b.priorityScore - a.priorityScore);
      setOrders(sorted);
      setLoading(false);
    });

    return () => stopListening();
  }, []);

  const dineInOrders = useMemo(() => orders.filter((o) => o.orderType === "dine_in"), [orders]);

  const inKitchenOrders = useMemo(
    () => dineInOrders.filter((o) => o.status === "created" || o.status === "confirmed" || o.status === "pending" || o.status === "preparing"),
    [dineInOrders]
  );
  const readyOrders = useMemo(() => dineInOrders.filter((o) => o.status === "ready"), [dineInOrders]);
  const inServiceOrders = useMemo(() => dineInOrders.filter((o) => o.status === "out_for_delivery"), [dineInOrders]);
  const completedOrders = useMemo(
    () => dineInOrders.filter((o) => o.status === "delivered" || o.status === "cancelled"),
    [dineInOrders]
  );

  const selectedOrder = useMemo(() => dineInOrders.find((o) => o.orderId === selectedOrderId) ?? null, [dineInOrders, selectedOrderId]);

  async function fetchOrderItems(orderId: string) {
    const cacheHit = orderItemsById[orderId];
    if (cacheHit) return;
    const q = query(collection(staffDb, "orderItems"), where("orderId", "==", orderId));
    const snap = await getDocs(q);
    const items = snap.docs.map((entry) => {
      const data = entry.data() as { name?: string; quantity?: number };
      return { name: data.name ?? "Item", quantity: Number(data.quantity ?? 1) };
    });
    setOrderItemsById((prev) => ({ ...prev, [orderId]: items }));
  }

  async function updateWaiterOrder(orderId: string, status: "out_for_delivery" | "delivered") {
    try {
      const callable = httpsCallable(staffFunctions, "updateOrderStatusV1");
      await callable({ orderId, status });
    } catch (error) {
      console.error("Waiter status update failed:", error);
    }
  }

  function addToCart(product: { id: string; name: string; price: number }) {
    setCart((prev) => {
      const existing = prev[product.id];
      const qty = (existing?.quantity ?? 0) + 1;
      return {
        ...prev,
        [product.id]: { name: product.name, price: product.price, quantity: qty }
      };
    });
  }

  function decFromCart(productId: string) {
    setCart((prev) => {
      const existing = prev[productId];
      if (!existing) return prev;
      const nextQty = existing.quantity - 1;
      if (nextQty <= 0) {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: { ...existing, quantity: nextQty } };
    });
  }

  async function placeTableOrder() {
    const tNo = tableNumber.trim();
    if (!tNo) {
      Alert.alert("Table number required", "Enter a table number before placing the order.");
      return;
    }
    if (!branchId) {
      Alert.alert("Branch missing", "Your staff profile is missing a branchId.");
      return;
    }

    const items = Object.entries(cart)
      .map(([productId, line]) => ({ productId, quantity: line.quantity }))
      .filter((x) => x.quantity > 0);

    if (items.length === 0) {
      Alert.alert("Cart is empty", "Add at least one item to place an order.");
      return;
    }

    try {
      const callable = httpsCallable(staffFunctions, "createOrderV1");
      await callable({
        branchId,
        orderType: "dine_in",
        paymentMethod,
        notes: `Table ${tNo}`,
        items
      });

      setCart({});
      Alert.alert("Order placed", "Your table order was sent to the kitchen.");
    } catch (e) {
      console.error("Failed placing table order:", e);
      Alert.alert("Order failed", "Could not place the order. Please try again.");
    }
  }

  return (
    <View>
      <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Create Table Order</Text>

        <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 6 }}>Table number</Text>
        <TextInput
          value={tableNumber}
          onChangeText={setTableNumber}
          placeholder="e.g., 5"
          keyboardType="numeric"
          style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "white", marginBottom: 10 }}
        />

        <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 6 }}>Payment method</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          {(["cash", "upi"] as const).map((pm) => (
            <TouchableOpacity
              key={pm}
              onPress={() => setPaymentMethod(pm)}
              style={{
                borderRadius: 999,
                backgroundColor: paymentMethod === pm ? "#FF6B35" : "#e2e8f0",
                paddingHorizontal: 12,
                paddingVertical: 8
              }}
            >
              <Text style={{ color: paymentMethod === pm ? "white" : "#111827", fontWeight: "700", fontSize: 12 }}>
                {pm.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Cart</Text>
        {cartLines.length === 0 ? (
          <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 6 }}>No items added.</Text>
        ) : (
          <View style={{ marginBottom: 8 }}>
            {cartLines.slice(0, 4).map((line) => (
              <Text key={line.productId} style={{ color: "#334155", fontSize: 12, marginBottom: 2 }}>
                • {line.name} x{line.quantity} (Rs. {line.price})
              </Text>
            ))}
            <Text style={{ color: "#0f172a", fontWeight: "800", fontSize: 12, marginTop: 6 }}>Total: Rs. {cartTotal}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => void placeTableOrder()}
          style={{ borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: cartLines.length ? "#0EA5E9" : "#94a3b8" }}
          disabled={!cartLines.length}
        >
          <Text style={{ color: "white", fontWeight: "900", fontSize: 12 }}>Send to kitchen</Text>
        </TouchableOpacity>
      </View>

      <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>Menu</Text>

        {menuLoading ? (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator color="#FF6B35" />
            <Text style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>Loading menu…</Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {categories.map((c) => {
                  const active = selectedCategoryId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setSelectedCategoryId(c.id)}
                      style={{
                        borderRadius: 999,
                        backgroundColor: active ? "#FF6B35" : "#e2e8f0",
                        paddingHorizontal: 12,
                        paddingVertical: 8
                      }}
                    >
                      <Text style={{ color: active ? "white" : "#111827", fontWeight: "700", fontSize: 12 }}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {products.length === 0 ? (
              <Text style={{ color: "#64748b", fontSize: 12 }}>No items found for this category.</Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap" as any }}>
                {products.map((p) => {
                  const line = cart[p.id];
                  const qty = line?.quantity ?? 0;
                  return (
                    <View key={p.id} style={{ width: "48%", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "white", padding: 10, marginBottom: 10, marginRight: "4%" }}>
                      <Text style={{ fontWeight: "800", fontSize: 12, color: "#0f172a" }} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>Rs. {p.price}</Text>

                      <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
                        <TouchableOpacity
                          onPress={() => decFromCart(p.id)}
                          style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" }}
                          disabled={qty <= 0}
                        >
                          <Text style={{ fontWeight: "900", color: qty <= 0 ? "#94a3b8" : "#0f172a" }}>-</Text>
                        </TouchableOpacity>
                        <Text style={{ fontWeight: "900", fontSize: 12, color: "#0f172a", width: 24, textAlign: "center" }}>{qty}</Text>
                        <TouchableOpacity
                          onPress={() => addToCart(p)}
                          style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: "#0EA5E9", alignItems: "center", justifyContent: "center" }}
                        >
                          <Text style={{ fontWeight: "900", color: "white" }}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>

      <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
        <Text style={{ fontWeight: "700", marginBottom: 4 }}>Service Queue</Text>
        <Text style={{ color: "#64748b", fontSize: 12 }}>Update status when served</Text>
      </View>

      {loading ? (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 20 }}>
          <ActivityIndicator color="#FF6B35" />
          <Text style={{ marginTop: 8, color: "#64748b" }}>Loading table orders…</Text>
        </View>
      ) : (
        <View>
          <OrderBoardColumn
            title="In Kitchen"
            count={inKitchenOrders.length}
            orders={inKitchenOrders}
            onSelect={async (orderId) => {
              setSelectedOrderId(orderId);
              await fetchOrderItems(orderId);
            }}
            displayMode={"normal"}
            color="#64748b"
          />
          <OrderBoardColumn
            title="Ready to Serve"
            count={readyOrders.length}
            orders={readyOrders}
            onSelect={async (orderId) => {
              setSelectedOrderId(orderId);
              await fetchOrderItems(orderId);
            }}
            displayMode={"normal"}
            color="#0EA5E9"
          />
          <OrderBoardColumn
            title="In Service"
            count={inServiceOrders.length}
            orders={inServiceOrders}
            onSelect={async (orderId) => {
              setSelectedOrderId(orderId);
              await fetchOrderItems(orderId);
            }}
            displayMode={"normal"}
            color="#16A34A"
          />
          <OrderBoardColumn
            title="Completed"
            count={completedOrders.length}
            orders={completedOrders}
            onSelect={async (orderId) => {
              setSelectedOrderId(orderId);
              await fetchOrderItems(orderId);
            }}
            displayMode={"normal"}
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

              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {selectedOrder.status === "ready" ? (
                  <StatusButton
                    label="Send to table"
                    color="#0EA5E9"
                    onPress={() => updateWaiterOrder(selectedOrder.orderId, "out_for_delivery")}
                  />
                ) : null}
                {selectedOrder.status === "out_for_delivery" ? (
                  <StatusButton
                    label="Served"
                    color="#16A34A"
                    onPress={() => updateWaiterOrder(selectedOrder.orderId, "delivered")}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function CashierPanel() {
  const [orders, setOrders] = useState<
    Array<{
      id: string;
      status?: string;
      orderType?: string;
      total?: number;
      paymentMethod?: "cash" | "upi" | "online";
      paymentStatus?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    setLoading(true);
    try {
      const callable = httpsCallable(staffFunctions, "listOrdersV1");
      const resp = await callable({ status: "created", limit: 20 });
      const data = resp.data as { success?: boolean; items?: Array<any> };
      setOrders((data.items ?? []) as any);
    } catch (error) {
      console.error("Failed to load cashier orders:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  async function markCashPaid(orderId: string, amount: number) {
    const callable = httpsCallable(staffFunctions, "markCashPaymentV1");
    await callable({ orderId, amount });
    await loadOrders();
  }

  return (
    <View>
      <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
        <Text style={{ fontWeight: "700", marginBottom: 4 }}>Counter / POS</Text>
        <Text style={{ color: "#64748b", fontSize: 12 }}>Cashier view • mark cash as paid</Text>
      </View>

      {loading ? (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 20 }}>
          <ActivityIndicator color="#FF6B35" />
          <Text style={{ marginTop: 8, color: "#64748b" }}>Loading orders…</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 12 }}>
          <Text style={{ color: "#64748b", fontSize: 12 }}>No created orders.</Text>
        </View>
      ) : (
        <ScrollView>
          {orders.map((o) => {
            const canMarkCash =
              o.paymentMethod === "cash" &&
              (o.paymentStatus ?? "").toLowerCase() !== "paid" &&
              o.status !== "cancelled" &&
              o.status !== "delivered";

            return (
              <View
                key={o.id}
                style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#f1f5f9" }}
              >
                <Text style={{ fontWeight: "800", fontSize: 14 }}>Order: {o.id}</Text>
                <Text style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                  {o.orderType ?? "—"} • Rs. {o.total ?? 0} • Status: {o.status ?? "—"}
                </Text>
                <Text style={{ marginTop: 2, color: "#64748b", fontSize: 12 }}>
                  Payment: {o.paymentMethod ?? "—"} • Payment status: {o.paymentStatus ?? "—"}
                </Text>

                {canMarkCash ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <StatusButton
                      label="Mark cash paid"
                      color="#16A34A"
                      onPress={() => void markCashPaid(o.id, Number(o.total ?? 0))}
                    />
                  </View>
                ) : (
                  <View style={{ marginTop: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" }}>
                    <Text style={{ color: "#64748b", fontWeight: "700", fontSize: 12 }}>Cash payment not needed</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export function ManagerPanel() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<{
    totalOrders?: number;
    deliveredOrders?: number;
    grossSales?: number;
    collectedAmount?: number;
    from?: string;
    to?: string;
  } | null>(null);
  const [recentOrders, setRecentOrders] = useState<Array<any>>([]);

  async function loadAll() {
    setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const to = now.toISOString();

      const salesCallable = httpsCallable(staffFunctions, "getSalesReportV1");
      const salesResp = await salesCallable({ from, to });
      const salesData = salesResp.data as { success?: boolean; report?: any };
      setReport(salesData.report ?? null);

      const listCallable = httpsCallable(staffFunctions, "listOrdersV1");
      const listResp = await listCallable({ limit: 10 });
      const listData = listResp.data as { success?: boolean; items?: Array<any> };
      setRecentOrders(listData.items ?? []);
    } catch (error) {
      console.error("Failed to load manager dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <View>
      <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
        <Text style={{ fontWeight: "700", marginBottom: 4 }}>Manager Dashboard</Text>
        <Text style={{ color: "#64748b", fontSize: 12 }}>Last 24 hours • sales + recent orders</Text>
      </View>

      {loading ? (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 20 }}>
          <ActivityIndicator color="#FF6B35" />
          <Text style={{ marginTop: 8, color: "#64748b" }}>Loading report…</Text>
        </View>
      ) : report ? (
        <ScrollView>
          <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#f1f5f9" }}>
            <Text style={{ fontWeight: "900", fontSize: 16, marginBottom: 6 }}>Sales Summary</Text>
            <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: 12 }}>Total orders: {report.totalOrders ?? 0}</Text>
            <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: 12, marginTop: 4 }}>Delivered: {report.deliveredOrders ?? 0}</Text>
            <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: 12, marginTop: 4 }}>Gross sales: Rs. {report.grossSales ?? 0}</Text>
            <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: 12, marginTop: 4 }}>Collected: Rs. {report.collectedAmount ?? 0}</Text>
          </View>

          <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#f1f5f9" }}>
            <Text style={{ fontWeight: "900", fontSize: 16, marginBottom: 6 }}>Recent Orders</Text>
            {recentOrders.length === 0 ? (
              <Text style={{ color: "#64748b", fontSize: 12 }}>No recent orders.</Text>
            ) : (
              recentOrders.map((o) => (
                <View
                  key={o.id ?? o.orderId ?? Math.random().toString(16)}
                  style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}
                >
                  <Text style={{ fontWeight: "800", color: "#0f172a" }}>{o.id ?? o.orderId}</Text>
                  <Text style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                    {o.orderType ?? "—"} • Rs. {o.total ?? 0} • Status: {o.status ?? "—"}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={{ borderRadius: 12, backgroundColor: "white", padding: 12 }}>
          <Text style={{ color: "#64748b", fontSize: 12 }}>Report unavailable.</Text>
        </View>
      )}
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
