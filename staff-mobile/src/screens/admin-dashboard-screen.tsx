import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { StaffScreenHeader } from "../components/staff-dashboard/staff-screen-header";
import { StatCard } from "../components/staff-dashboard/stat-card";
import { StaffErrorView } from "../components/staff-dashboard/staff-error-view";
import { EmptyState } from "../components/ux/empty-state";
import { STAFF_ORDERS_QUERY_LIMIT, useOrdersMetrics } from "../hooks/use-orders-metrics";
import { space } from "../theme/design-tokens";
import { cardShadow, staffColors } from "../theme/staff-ui";

/** Default dev URL; override for production builds. */
const ADMIN_WEB_URL = "http://127.0.0.1:3001";

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

export function AdminDashboardScreen() {
  const [listenerKey, setListenerKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const metrics = useOrdersMetrics(true, listenerKey);

  useEffect(() => {
    if (!metrics.loading) setRefreshing(false);
  }, [metrics.loading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setListenerKey((n) => n + 1);
  }, []);

  return (
    <FeatureGate feature="admin_panel" fallback={<NoAccessView subtitle="Admin tools are not available for your role." />}>
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
      <StaffScreenHeader role="admin" title="Operations hub" subtitle="Live snapshot from Firestore (pull to refresh)." />

      {metrics.error ? (
        <StaffErrorView message={metrics.error} onRetry={() => setListenerKey((n) => n + 1)} />
      ) : null}

      {metrics.loading && !metrics.error ? (
        <View style={{ alignItems: "center", paddingVertical: space.xl, marginBottom: space.md }}>
          <ActivityIndicator size="large" color={staffColors.accent} />
          <Text style={{ marginTop: space.sm, color: staffColors.muted, fontWeight: "600" }}>Syncing orders…</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <StatCard label="Orders (sample)" value={metrics.orderCount} hint={`Up to ${STAFF_ORDERS_QUERY_LIMIT} docs in query`} accent={staffColors.info} />
        <StatCard label="Open pipeline" value={metrics.openOrders} hint="Not delivered / cancelled" accent={staffColors.warning} />
        <StatCard label="Delivered revenue" value={formatMoney(metrics.deliveredRevenue)} hint="Sum for delivered in sample" accent={staffColors.success} />
      </View>

      <View style={[{ borderRadius: 16, padding: 14, marginBottom: 16, backgroundColor: staffColors.surface, borderWidth: 1, borderColor: staffColors.border }, cardShadow()]}>
        <Text style={{ fontSize: 11, fontWeight: "800", color: staffColors.muted, letterSpacing: 0.5 }}>STATUS MIX (SAMPLE)</Text>
        {!metrics.loading && !metrics.error && metrics.orderCount === 0 ? (
          <View style={{ marginTop: space.sm }}>
            <EmptyState icon="📊" title="No orders in sample" subtitle="Create a test order from POS or customer web to see metrics here." />
          </View>
        ) : null}
        {!metrics.loading && metrics.orderCount > 0 && Object.keys(metrics.byStatus).length === 0 ? (
          <Text style={{ marginTop: 8, color: staffColors.muted }}>—</Text>
        ) : null}
        {Object.keys(metrics.byStatus).length === 0 ? null : (
          Object.entries(metrics.byStatus)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={{ color: staffColors.text, fontWeight: "600", textTransform: "capitalize" }}>{k}</Text>
                <Text style={{ fontWeight: "800", color: staffColors.accent }}>{v}</Text>
              </View>
            ))
        )}
      </View>

      <View style={[{ borderRadius: 16, padding: 16, backgroundColor: staffColors.surface, borderWidth: 1, borderColor: staffColors.border }, cardShadow()]}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: staffColors.text }}>Staff & catalog</Text>
        <Text style={{ marginTop: 6, color: staffColors.muted, fontSize: 13, lineHeight: 18 }}>
          Full staff management, menu edits, branches, and deep analytics run in the web admin console.
        </Text>
        <TouchableOpacity
          onPress={() => void Linking.openURL(ADMIN_WEB_URL)}
          style={{
            marginTop: 14,
            alignSelf: "flex-start",
            backgroundColor: staffColors.accent,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 12
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Open admin dashboard (web)</Text>
        </TouchableOpacity>
      </View>

      <View style={[{ marginTop: 14, borderRadius: 16, padding: 14, backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" }, cardShadow()]}>
        <Text style={{ fontWeight: "800", color: "#3730A3" }}>Analytics</Text>
        <Text style={{ marginTop: 6, color: "#4338CA", fontSize: 13, lineHeight: 18 }}>
          Use the Analytics tab in the web admin for charts and exports. Mobile shows operational KPIs only.
        </Text>
      </View>
    </ScrollView>
    </FeatureGate>
  );
}
