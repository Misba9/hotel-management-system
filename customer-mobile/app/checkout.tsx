import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { Button } from "@/src/components/ui/button";
import { useCart } from "@/src/context/cart-context";
import { useAuth } from "@/src/context/auth-context";
import { apiFetch } from "@/src/lib/api";
import { buildAuthHeaders } from "@/src/lib/user-session";

export default function CheckoutScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { items, grandTotal, subtotal, deliveryFee, discount, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function placeOrder() {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (items.length === 0) return;

    setLoading(true);
    setError("");
    try {
      const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/api/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity
          })),
          paymentMethod: "cod",
          orderType: "delivery"
        })
      });
      const data = (await res.json()) as { orderId?: string; success?: boolean; error?: string };
      if (!res.ok || !data.orderId) {
        setError(data.error || "Checkout failed. Please try again.");
        return;
      }
      clearCart({ silent: true });
      router.replace({ pathname: "/order-success", params: { orderId: data.orderId } });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Checkout" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.section, { color: colors.textPrimary }]}>Order summary</Text>
          {items.map((item) => (
            <View key={item.productId} style={styles.row}>
              <Text style={{ color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                {item.quantity}× {item.name}
              </Text>
              <Text style={{ color: colors.textPrimary }}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={{ color: colors.textSecondary }}>Subtotal</Text>
            <Text style={{ color: colors.textPrimary }}>₹{subtotal}</Text>
          </View>
          {discount > 0 ? (
            <View style={styles.row}>
              <Text style={{ color: colors.textSecondary }}>Discount</Text>
              <Text style={{ color: colors.success }}>−₹{discount}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={{ color: colors.textSecondary }}>Delivery</Text>
            <Text style={{ color: colors.textPrimary }}>₹{deliveryFee}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.total, { color: colors.textPrimary }]}>Total</Text>
            <Text style={[styles.total, { color: colors.primary }]}>₹{grandTotal}</Text>
          </View>
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Payment: Cash on delivery. Online payment via Razorpay is available on the web app.
        </Text>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <Button title="Place order" onPress={placeOrder} loading={loading} />
        <Button title="Manage addresses" variant="ghost" onPress={() => router.push("/addresses")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  section: { fontSize: 17, fontWeight: "800", marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  divider: { height: 1, marginVertical: 12 },
  total: { fontSize: 18, fontWeight: "900" },
  note: { fontSize: 13, marginBottom: 20, lineHeight: 18 },
  error: { marginBottom: 12, textAlign: "center" }
});
