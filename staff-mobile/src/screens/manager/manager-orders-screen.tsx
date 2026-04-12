import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { httpsCallable } from "firebase/functions";
import { FeatureGate, NoAccessView } from "../../components/feature-gate";
import { StaffScreenHeader } from "../../components/staff-dashboard/staff-screen-header";
import { StaffErrorView } from "../../components/staff-dashboard/staff-error-view";
import { useOrdersMetrics } from "../../hooks/use-orders-metrics";
import { staffFunctions } from "../../lib/firebase";
import { cardShadow, staffColors } from "../../theme/staff-ui";

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s === "pending" || s === "created" || s === "confirmed") return "#F59E0B";
  if (s === "preparing" || s === "accepted") return "#0EA5E9";
  if (s === "ready") return "#16A34A";
  if (s === "out_for_delivery") return "#7C3AED";
  if (s === "delivered") return "#15803D";
  if (s === "cancelled" || s === "rejected") return "#94A3B8";
  return staffColors.muted;
}

export function ManagerOrdersScreen() {
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const metrics = useOrdersMetrics(true, retry);

  const updateStatus = useCallback(async (orderId: string, status: string) => {
    setBusyId(orderId);
    try {
      const callable = httpsCallable(staffFunctions, "updateOrderStatusV1");
      await callable({ orderId, status });
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <FeatureGate feature="orders" fallback={<NoAccessView subtitle="You do not have access to orders." />}>
      <ScrollView style={{ flex: 1, backgroundColor: staffColors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <StaffScreenHeader role="manager" title="All orders" subtitle="Live Firestore feed — update status for the line." />

        {metrics.error ? <StaffErrorView message={metrics.error} onRetry={() => setRetry((n) => n + 1)} /> : null}

        {metrics.loading && !metrics.error ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <ActivityIndicator color={staffColors.accent} size="large" />
            <Text style={{ marginTop: 10, color: staffColors.muted }}>Loading orders…</Text>
          </View>
        ) : null}

        {!metrics.loading && metrics.recentOrders.length === 0 ? (
          <Text style={{ color: staffColors.muted }}>No orders in the current sample.</Text>
        ) : null}

        {metrics.recentOrders.map((o) => {
          const st = (o.status ?? "pending").toLowerCase();
          const total = o.total ?? o.totalAmount ?? 0;
          const accent = statusColor(st);
          return (
            <View
              key={o.id}
              style={[
                {
                  marginBottom: 12,
                  borderRadius: 16,
                  padding: 14,
                  backgroundColor: staffColors.surface,
                  borderLeftWidth: 4,
                  borderLeftColor: accent,
                  borderWidth: 1,
                  borderColor: staffColors.border
                },
                cardShadow()
              ]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontWeight: "900", color: staffColors.text, fontSize: 15 }}>{o.customerName?.trim() || "Order"}</Text>
                  <Text style={{ marginTop: 2, color: staffColors.muted, fontSize: 12 }}>#{o.id}</Text>
                  <Text style={{ marginTop: 4, color: staffColors.muted, fontSize: 12 }}>
                    {o.orderType ? `${o.orderType} · ` : ""}Rs. {Number(total).toLocaleString()}
                  </Text>
                </View>
                <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: `${accent}22` }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: accent }}>{st.toUpperCase()}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {st === "pending" || st === "created" || st === "confirmed" ? (
                  <MiniAction label="Preparing" onPress={() => void updateStatus(o.id, "preparing")} disabled={busyId === o.id} />
                ) : null}
                {(st === "preparing" || st === "accepted") && (
                  <MiniAction label="Ready" onPress={() => void updateStatus(o.id, "ready")} disabled={busyId === o.id} />
                )}
                {st === "ready" ? <MiniAction label="Out for delivery" onPress={() => void updateStatus(o.id, "out_for_delivery")} disabled={busyId === o.id} /> : null}
                {st === "out_for_delivery" ? <MiniAction label="Delivered" onPress={() => void updateStatus(o.id, "delivered")} disabled={busyId === o.id} /> : null}
                {busyId === o.id ? <ActivityIndicator style={{ marginLeft: 4 }} color={staffColors.accent} /> : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </FeatureGate>
  );
}

function MiniAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: disabled ? "#e2e8f0" : staffColors.accent
      }}
    >
      <Text style={{ color: disabled ? "#94a3b8" : "white", fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}
