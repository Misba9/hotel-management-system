import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { LoadingView } from "@/src/components/ui/loading-view";
import { useAuth } from "@/src/context/auth-context";
import { useCustomerOrders } from "@/src/hooks/use-customer-orders";
import { isCancelledStatus } from "@/src/lib/order-tracking";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function OrdersScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orders, loading, error } = useCustomerOrders(user?.uid);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  if (loading && orders.length === 0) return <LoadingView message="Loading orders…" />;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>My orders</Text>
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>📦</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No orders yet</Text>
            <Text style={{ color: colors.textSecondary }}>Your order history will appear here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/order-tracking", params: { orderId: item.id } })
            }
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.orderId, { color: colors.textPrimary }]}>#{item.trackingId || item.id.slice(0, 8)}</Text>
              <Text
                style={[
                  styles.status,
                  {
                    color: isCancelledStatus(item.status) ? colors.danger : colors.primary,
                    backgroundColor: isCancelledStatus(item.status) ? `${colors.danger}20` : `${colors.primary}20`
                  }
                ]}
              >
                {item.status.replace(/_/g, " ")}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }} numberOfLines={1}>
              {item.itemsSummary}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatDate(item.createdAt)}</Text>
              <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>₹{item.amount}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "900" },
  error: { padding: 16, textAlign: "center" },
  list: { padding: 16, paddingBottom: 24 },
  empty: { alignItems: "center", padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginTop: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { fontWeight: "800", fontSize: 15 },
  status: { fontSize: 11, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, textTransform: "capitalize" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, alignItems: "center" }
});
