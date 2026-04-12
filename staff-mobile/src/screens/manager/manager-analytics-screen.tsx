import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { FeatureGate, NoAccessView } from "../../components/feature-gate";
import { StaffScreenHeader } from "../../components/staff-dashboard/staff-screen-header";
import { StatCard } from "../../components/staff-dashboard/stat-card";
import { StaffErrorView } from "../../components/staff-dashboard/staff-error-view";
import { useOrdersMetrics } from "../../hooks/use-orders-metrics";
import { cardShadow, staffColors } from "../../theme/staff-ui";

export function ManagerAnalyticsScreen() {
  const [retry, setRetry] = useState(0);
  const metrics = useOrdersMetrics(true, retry);
  const statusRows = Object.entries(metrics.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <FeatureGate feature="analytics" fallback={<NoAccessView subtitle="You do not have access to analytics." />}>
      <ScrollView style={{ flex: 1, backgroundColor: staffColors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <StaffScreenHeader role="manager" title="Analytics snapshot" subtitle="Derived from the same capped `orders` query as the dashboard." />

        {metrics.error ? <StaffErrorView message={metrics.error} onRetry={() => setRetry((n) => n + 1)} /> : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <StatCard label="Orders in sample" value={metrics.loading ? "…" : metrics.orderCount} accent={staffColors.info} />
          <StatCard label="Pipeline (open)" value={metrics.loading ? "…" : metrics.openOrders} accent={staffColors.warning} />
        </View>

        <View style={[{ borderRadius: 16, padding: 14, backgroundColor: staffColors.surface, borderWidth: 1, borderColor: staffColors.border }, cardShadow()]}>
          <Text style={{ fontWeight: "800", marginBottom: 10, color: staffColors.text }}>Status mix</Text>
          {statusRows.length === 0 ? (
            <Text style={{ color: staffColors.muted }}>No data yet.</Text>
          ) : (
            statusRows.map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: staffColors.border }}>
                <Text style={{ color: staffColors.text, fontWeight: "600", textTransform: "capitalize" }}>{k}</Text>
                <Text style={{ color: staffColors.accent, fontWeight: "800" }}>{v}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </FeatureGate>
  );
}
