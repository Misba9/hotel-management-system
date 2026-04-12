import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, Text, TouchableOpacity, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { collection, getDocs, onSnapshot, query, where, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { staffDb, staffFunctions } from "../lib/firebase";
import { useAuth } from "../context/AuthProvider";
import { createDineInOrder } from "../services/orders.js";

function Card({ text }: { text: string }) {
  return (
    <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
      <Text>{text}</Text>
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
  type Product = { id: string; name: string; price: number };
  type CartLine = { productId: string; name: string; price: number; quantity: number };

  const { user } = useAuth();
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [cart, setCart] = useState<Record<string, CartLine>>({});

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(() => cartLines.reduce((sum, l) => sum + l.price * l.quantity, 0), [cartLines]);

  useEffect(() => {
    void (async () => {
      setMenuLoading(true);
      try {
        const catsSnap = await getDocs(collection(staffDb, "categories"));
        const cats = catsSnap.docs
          .map((d) => {
            const data = d.data() as { name?: string };
            return { id: d.id, name: String(data.name ?? "") };
          })
          .filter((c) => c.id && c.name);
        setCategories(cats);
        if (cats.length > 0) setSelectedCategoryId(cats[0].id);
      } catch (e) {
        console.error("Failed loading categories:", e);
        Alert.alert("Menu error", "Unable to load categories.");
      } finally {
        setMenuLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCategoryId) return;
    setMenuLoading(true);
    void (async () => {
      try {
        const q = query(collection(staffDb, "products"), where("categoryId", "==", selectedCategoryId));
        const snap = await getDocs(q);
        const items = snap.docs
          .map((d) => {
            const data = d.data() as { name?: string; price?: number; isAvailable?: boolean; available?: boolean };
            return {
              id: d.id,
              name: String(data.name ?? ""),
              price: Number(data.price ?? 0),
              isAvailable: Boolean(data.isAvailable ?? data.available ?? false)
            };
          })
          .filter((p) => p.isAvailable)
          .map(({ id, name, price }) => ({ id, name, price }));
        setProducts(items);
      } catch (e) {
        console.error("Failed loading products:", e);
        Alert.alert("Menu error", "Unable to load items.");
      } finally {
        setMenuLoading(false);
      }
    })();
  }, [selectedCategoryId]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev[product.id];
      const qty = (existing?.quantity ?? 0) + 1;
      return {
        ...prev,
        [product.id]: { productId: product.id, name: product.name, price: product.price, quantity: qty }
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
    if (!selectedTable) {
      Alert.alert("Table required", "Select a table first.");
      return;
    }
    if (cartLines.length === 0) {
      Alert.alert("Cart empty", "Add at least one item.");
      return;
    }
    const waiterUid = user?.uid;
    if (!waiterUid) {
      Alert.alert("Sign in required", "You must be signed in to place an order.");
      return;
    }
    setPlacing(true);
    try {
      await createDineInOrder({
        userId: waiterUid,
        tableNumber: selectedTable,
        total: cartTotal,
        items: cartLines.map((line) => ({
          name: line.name,
          qty: line.quantity,
          price: line.price
        }))
      });
      setCart({});
      Alert.alert("Sent to kitchen", `Order for Table ${selectedTable} placed.`);
    } catch (e) {
      console.error("Failed placing waiter order:", e);
      Alert.alert("Order failed", "Could not place order.");
    } finally {
      setPlacing(false);
    }
  }

  if (!selectedTable) {
    return (
      <View>
        <View style={{ borderRadius: 14, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
          <Text style={{ fontWeight: "900", fontSize: 20, color: "#0f172a", marginBottom: 4 }}>Table Selection</Text>
          <Text style={{ color: "#64748b", fontSize: 12 }}>Tap a table to open order screen.</Text>
        </View>
        <View style={{ borderRadius: 14, backgroundColor: "white", padding: 14 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" as any, gap: 8 }}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((tableNo) => (
              <TouchableOpacity
                key={tableNo}
                onPress={() => setSelectedTable(tableNo)}
                style={{
                  width: "23%",
                  borderRadius: 12,
                  backgroundColor: "#f1f5f9",
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  paddingVertical: 14,
                  alignItems: "center"
                }}
              >
                <Text style={{ fontWeight: "900", fontSize: 16, color: "#0f172a" }}>{tableNo}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={{ borderRadius: 14, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontWeight: "900", fontSize: 18, color: "#0f172a" }}>Table {selectedTable}</Text>
            <Text style={{ color: "#64748b", fontSize: 12 }}>Add items and send order to kitchen.</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedTable(null);
              setCart({});
            }}
            style={{ borderRadius: 999, backgroundColor: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Text style={{ color: "#0f172a", fontWeight: "800", fontSize: 12 }}>Change Table</Text>
          </TouchableOpacity>
        </View>
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

            <View style={{ flexDirection: "row", flexWrap: "wrap" as any }}>
              {products.map((p) => {
                const qty = cart[p.id]?.quantity ?? 0;
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
          </>
        )}
      </View>

      <View style={{ borderRadius: 12, backgroundColor: "white", padding: 14, marginBottom: 10 }}>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Order Summary</Text>
        {cartLines.length === 0 ? (
          <Text style={{ color: "#64748b", fontSize: 12 }}>No items added.</Text>
        ) : (
          cartLines.map((line) => (
            <Text key={line.productId} style={{ color: "#334155", fontSize: 12, marginBottom: 2 }}>
              • {line.name} x{line.quantity} = Rs. {line.price * line.quantity}
            </Text>
          ))
        )}
        <Text style={{ marginTop: 8, color: "#0f172a", fontWeight: "900", fontSize: 14 }}>Total: Rs. {cartTotal}</Text>
        <View style={{ marginTop: 10 }}>
          <StatusButton
            label={placing ? "Placing..." : "Place Order (Send to Kitchen)"}
            color={cartLines.length === 0 || placing ? "#94a3b8" : "#16A34A"}
            onPress={() => {
              if (!placing) void placeTableOrder();
            }}
          />
        </View>
      </View>
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

export { KitchenOrdersBoard as KitchenPanel } from "./kitchen-orders-board";
export { DeliveryDashboardBoard as DeliveryPanel } from "./delivery-dashboard-board";
