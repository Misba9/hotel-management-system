import React, { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { CashierDashboardMetrics } from "./pos-types";
import { PosIcon, type PosIconName } from "./pos-icons";
import { posColors, posRadius, posSpacing, posType } from "./pos-theme";

type Props = { metrics: CashierDashboardMetrics };

type MetricItem = {
  key: string;
  label: string;
  value: string;
  icon: PosIconName;
  color: string;
};

function formatMoney(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export const PosMetricsStrip = memo(function PosMetricsStrip({ metrics }: Props) {
  const items: MetricItem[] = [
    { key: "orders", label: "Today's Orders", value: String(metrics.todayOrders), icon: "orders", color: posColors.primary },
    { key: "revenue", label: "Today's Revenue", value: formatMoney(metrics.todaySales), icon: "sales", color: posColors.success },
    { key: "tables", label: "Active Tables", value: String(metrics.activeTables), icon: "table", color: "#8B5CF6" },
    { key: "pending", label: "Pending Bills", value: String(metrics.pendingBills), icon: "pending", color: posColors.warning },
    { key: "kitchen", label: "Kitchen Orders", value: String(metrics.kitchenCount), icon: "kitchen", color: posColors.statusPreparing },
    { key: "delivery", label: "Delivery Orders", value: String(metrics.deliveryCount), icon: "parcel", color: posColors.info }
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.wrap}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => (
        <View key={item.key} style={[styles.chip, { borderLeftColor: item.color }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${item.color}18` }]}>
            <PosIcon name={item.icon} size={12} color={item.color} />
          </View>
          <View>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={posType.metric}>{item.value}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  wrap: { maxHeight: 52, backgroundColor: posColors.bg, borderBottomWidth: 1, borderBottomColor: posColors.border },
  row: { paddingHorizontal: posSpacing.md, paddingVertical: posSpacing.xs, gap: posSpacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    paddingHorizontal: posSpacing.md,
    paddingVertical: posSpacing.xs,
    borderRadius: posRadius.sm,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border,
    borderLeftWidth: 3,
    minWidth: 130
  },
  iconWrap: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  label: { ...posType.label, fontSize: 8, marginBottom: 1 }
});
