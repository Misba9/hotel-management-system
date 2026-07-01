import { doc, onSnapshot } from "firebase/firestore";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { LoadingView } from "@/src/components/ui/loading-view";
import { ORDER_TRACKING_STEPS, isCancelledStatus, statusToTimelineIndex } from "@/src/lib/order-tracking";
import { db } from "@/src/services/firebase";

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const colors = useThemeColors();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "orders", orderId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setOrder(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [orderId]);

  if (loading) return <LoadingView message="Loading tracking…" />;

  const status = String(order?.status ?? "pending");
  const currentIdx = statusToTimelineIndex(status);
  const cancelled = isCancelledStatus(status);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Track order" />
      <ScrollView contentContainerStyle={styles.body}>
        {cancelled ? (
          <Text style={[styles.cancelled, { color: colors.danger }]}>This order was cancelled.</Text>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {ORDER_TRACKING_STEPS.map((step, idx) => {
            const done = currentIdx >= idx;
            const active = currentIdx === idx && !cancelled;
            return (
              <View key={step.key} style={styles.step}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: done ? colors.primary : colors.border,
                      borderColor: active ? colors.primary : "transparent",
                      borderWidth: active ? 3 : 0
                    }
                  ]}
                />
                <View style={styles.stepText}>
                  <Text style={[styles.stepLabel, { color: done ? colors.textPrimary : colors.textSecondary }]}>
                    {step.label}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{step.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {order ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Order ID</Text>
            <Text style={{ color: colors.textPrimary, fontWeight: "800", marginTop: 4 }}>{orderId}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 12 }}>Total</Text>
            <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 20, marginTop: 4 }}>
              ₹{Number(order.totalAmount ?? order.total ?? 0)}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>Order not found</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: 20 },
  cancelled: { textAlign: "center", fontWeight: "700", marginBottom: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  step: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  dot: { width: 16, height: 16, borderRadius: 8, marginTop: 2, marginRight: 14 },
  stepText: { flex: 1 },
  stepLabel: { fontWeight: "800", fontSize: 15 }
});
