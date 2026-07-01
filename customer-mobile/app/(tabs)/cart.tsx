import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Button } from "@/src/components/ui/button";
import { useCart } from "@/src/context/cart-context";
import { getLineTotal } from "@/src/lib/cart";

export default function CartScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, subtotal, deliveryFee, grandTotal, discount, updateQty, removeItem } = useCart();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Your cart</Text>
        <Text style={{ color: colors.textSecondary }}>{items.length} item(s)</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>🛒</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Cart is empty</Text>
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>Browse the menu and add fresh fruits</Text>
          <Button title="Browse menu" onPress={() => router.push("/(tabs)/home")} style={{ marginTop: 24 }} />
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.productId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.primary, fontWeight: "800" }}>₹{getLineTotal(item)}</Text>
                  <View style={styles.qtyRow}>
                    <Pressable onPress={() => updateQty(item.productId, item.quantity - 1)} style={styles.qtyBtn}>
                      <Text style={{ color: colors.textPrimary, fontSize: 18 }}>−</Text>
                    </Pressable>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700", minWidth: 24, textAlign: "center" }}>
                      {item.quantity}
                    </Text>
                    <Pressable onPress={() => updateQty(item.productId, item.quantity + 1)} style={styles.qtyBtn}>
                      <Text style={{ color: colors.textPrimary, fontSize: 18 }}>+</Text>
                    </Pressable>
                    <Pressable onPress={() => removeItem(item.productId)} style={{ marginLeft: "auto" }}>
                      <Text style={{ color: colors.danger, fontSize: 13 }}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          />

          <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={{ color: colors.textSecondary }}>Subtotal</Text>
              <Text style={{ color: colors.textPrimary }}>₹{subtotal}</Text>
            </View>
            {discount > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={{ color: colors.textSecondary }}>Discount</Text>
                <Text style={{ color: colors.success }}>−₹{discount}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={{ color: colors.textSecondary }}>Delivery</Text>
              <Text style={{ color: colors.textPrimary }}>₹{deliveryFee}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Total</Text>
              <Text style={[styles.totalLabel, { color: colors.primary }]}>₹{grandTotal}</Text>
            </View>
            <Button title="Proceed to checkout" onPress={() => router.push("/checkout")} />
            <Pressable onPress={() => router.push("/coupons")} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Apply coupon</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "900" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "800", marginTop: 12 },
  list: { padding: 16, paddingBottom: 8 },
  row: { flexDirection: "row", borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 14, fontWeight: "700" },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  qtyBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  summary: { borderTopWidth: 1, padding: 20, gap: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  totalRow: { marginTop: 4, marginBottom: 12 },
  totalLabel: { fontSize: 18, fontWeight: "900" }
});
