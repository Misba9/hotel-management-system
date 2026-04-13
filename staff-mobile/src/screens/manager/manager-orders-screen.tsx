import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { httpsCallable } from "firebase/functions";
import { FeatureGate, NoAccessView } from "../../components/feature-gate";
import { StaffScreenHeader } from "../../components/staff-dashboard/staff-screen-header";
import { useStaffAuth } from "../../context/staff-auth-context";
import { StaffErrorView } from "../../components/staff-dashboard/staff-error-view";
import { EmptyState } from "../../components/ux/empty-state";
import { useOrdersMetrics, type OrderDocShape } from "../../hooks/use-orders-metrics";
import { staffFunctions } from "../../lib/firebase";
import { space } from "../../theme/design-tokens";
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

type OrderRowProps = {
  o: OrderDocShape;
  busyId: string | null;
  onAccept: (id: string) => void;
  onPreparing: (id: string) => void;
  onReady: (id: string) => void;
  onOutForDelivery: (id: string) => void;
  onDelivered: (id: string) => void;
};

const ManagerOrderRow = React.memo(function ManagerOrderRow({
  o,
  busyId,
  onAccept,
  onPreparing,
  onReady,
  onOutForDelivery,
  onDelivered
}: OrderRowProps) {
  const st = (o.status ?? "pending").toLowerCase();
  const total = o.total ?? o.totalAmount ?? 0;
  const accent = statusColor(st);
  return (
    <View
      style={[
        {
          marginBottom: space.md,
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
          <MiniAction label="Accept" onPress={() => onAccept(o.id)} disabled={busyId === o.id} />
        ) : null}
        {st === "accepted" ? <MiniAction label="Preparing" onPress={() => onPreparing(o.id)} disabled={busyId === o.id} /> : null}
        {st === "preparing" ? <MiniAction label="Ready" onPress={() => onReady(o.id)} disabled={busyId === o.id} /> : null}
        {st === "ready" ? <MiniAction label="Out for delivery" onPress={() => onOutForDelivery(o.id)} disabled={busyId === o.id} /> : null}
        {st === "out_for_delivery" ? <MiniAction label="Delivered" onPress={() => onDelivered(o.id)} disabled={busyId === o.id} /> : null}
        {busyId === o.id ? <ActivityIndicator style={{ marginLeft: 4 }} color={staffColors.accent} /> : null}
      </View>
    </View>
  );
});

export function ManagerOrdersScreen() {
  const { staff } = useStaffAuth();
  const headerRole = staff?.role === "admin" ? "admin" : "manager";
  const [listenerKey, setListenerKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const metrics = useOrdersMetrics(true, listenerKey);

  useEffect(() => {
    if (!metrics.loading) setRefreshing(false);
  }, [metrics.loading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setListenerKey((n) => n + 1);
  }, []);

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

  const onAccept = useCallback((id: string) => void updateStatus(id, "accepted"), [updateStatus]);
  const onPreparing = useCallback((id: string) => void updateStatus(id, "preparing"), [updateStatus]);
  const onReady = useCallback((id: string) => void updateStatus(id, "ready"), [updateStatus]);
  const onOutForDelivery = useCallback((id: string) => void updateStatus(id, "out_for_delivery"), [updateStatus]);
  const onDelivered = useCallback((id: string) => void updateStatus(id, "delivered"), [updateStatus]);

  return (
    <FeatureGate feature="orders" fallback={<NoAccessView subtitle="You do not have access to orders." />}>
      <ScrollView
        style={{ flex: 1, backgroundColor: staffColors.bg }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={staffColors.accent}
            colors={[staffColors.accent]}
          />
        }
      >
        <StaffScreenHeader role={headerRole} title="All orders" subtitle="Live Firestore — pull to refresh." />

        {metrics.error ? (
          <StaffErrorView message={metrics.error} onRetry={() => setListenerKey((n) => n + 1)} />
        ) : null}

        {metrics.loading && !metrics.error ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
            <ActivityIndicator color={staffColors.accent} size="large" />
            <Text style={{ marginTop: space.sm, color: staffColors.muted, fontWeight: "600" }}>Loading orders…</Text>
          </View>
        ) : null}

        {!metrics.loading && !metrics.error && metrics.recentOrders.length === 0 ? (
          <EmptyState icon="📦" title="No orders in sample" subtitle="Orders appear here as they are created. Pull down to refresh." />
        ) : null}

        {metrics.recentOrders.map((o) => (
          <ManagerOrderRow
            key={o.id}
            o={o}
            busyId={busyId}
            onAccept={onAccept}
            onPreparing={onPreparing}
            onReady={onReady}
            onOutForDelivery={onOutForDelivery}
            onDelivered={onDelivered}
          />
        ))}
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
