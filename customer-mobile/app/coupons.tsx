import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useCart } from "@/src/context/cart-context";
import { useToast } from "@/src/context/toast-context";
import { apiFetch } from "@/src/lib/api";
import { buildUserHeaders } from "@/src/lib/user-session";

export default function CouponsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { applyCoupon, subtotal, couponCode } = useCart();
  const { showToast } = useToast();
  const [code, setCode] = useState(couponCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function validateCoupon() {
    setError("");
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a coupon code.");
      return;
    }

    setLoading(true);
    try {
      const headers = await buildUserHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/api/coupons/validate", {
        method: "POST",
        headers,
        body: JSON.stringify({ code: trimmed, subtotal })
      });
      const data = (await res.json()) as { valid?: boolean; discount?: number; error?: string };
      if (!res.ok || !data.valid) {
        setError(data.error || "Invalid or expired coupon.");
        return;
      }
      applyCoupon(trimmed, data.discount ?? 0);
      showToast({ title: "Coupon applied", description: `You saved ₹${data.discount}` });
      router.back();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Coupons" />
      <View style={styles.body}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Enter a promo code to get a discount on your order.
        </Text>
        <Input label="Coupon code" value={code} onChangeText={setCode} autoCapitalize="characters" />
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <Button title="Apply coupon" onPress={validateCoupon} loading={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: 20 },
  hint: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  error: { marginBottom: 12 }
});
