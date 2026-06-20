import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { CashierDashboardMetrics } from "./pos-types";
import { PosIcon, type PosIconName } from "./pos-icons";
import { posColors, posRadius, posSpacing, posType } from "./pos-theme";

type CardDef = {
  key: string;
  label: string;
  value: string;
  subtitle: string;
  trend: string;
  color: string;
  icon: PosIconName;
};

type Props = { metrics: CashierDashboardMetrics };

function formatMoney(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function DashboardSummaryCards({ metrics }: Props) {
  const cards: CardDef[] = [
    { key: "sales", label: "Today's Sales", value: formatMoney(metrics.todaySales), subtitle: "Gross", trend: "↑ Live", color: posColors.success, icon: "sales" },
    { key: "orders", label: "Orders", value: String(metrics.todayOrders), subtitle: "Today", trend: "Active", color: posColors.primary, icon: "orders" },
    { key: "dine", label: "Dine-In", value: String(metrics.dineInCount), subtitle: "Tables", trend: "Floor", color: "#8B5CF6", icon: "dine" },
    { key: "parcel", label: "Parcel", value: String(metrics.parcelCount), subtitle: "Takeaway", trend: "Counter", color: posColors.parcel, icon: "parcel" },
    { key: "swiggy", label: "Swiggy", value: String(metrics.swiggyCount), subtitle: "Aggregator", trend: "Partner", color: "#F97316", icon: "parcel" },
    { key: "zomato", label: "Zomato", value: String(metrics.zomatoCount), subtitle: "Aggregator", trend: "Partner", color: "#E23744", icon: "parcel" },
    { key: "pending", label: "Pending Bills", value: String(metrics.pendingBills), subtitle: "Payment", trend: "Queue", color: posColors.warning, icon: "pending" },
    { key: "kitchen", label: "Kitchen", value: String(metrics.kitchenCount), subtitle: "In prep", trend: "KDS", color: "#F59E0B", icon: "kitchen" },
    { key: "delivery", label: "Delivery", value: String(metrics.deliveryCount), subtitle: "Online", trend: "Hub", color: posColors.info, icon: "parcel" },
    { key: "tables", label: "Active Tables", value: String(metrics.activeTables), subtitle: "Floor", trend: "Live", color: "#8B5CF6", icon: "table" },
    { key: "drawer", label: "Cash Drawer", value: formatMoney(metrics.cashDrawer), subtitle: "Cash", trend: "Drawer", color: posColors.success, icon: "cash" },
    { key: "upi", label: "UPI", value: formatMoney(metrics.upiTotal), subtitle: "Digital", trend: "UPI", color: "#06B6D4", icon: "upi" },
    { key: "card", label: "Card", value: formatMoney(metrics.cardTotal), subtitle: "Card", trend: "Card", color: posColors.primary, icon: "card" },
    { key: "avg", label: "Avg Bill", value: formatMoney(metrics.averageBill), subtitle: "Per ticket", trend: "AVG", color: posColors.textSecondary, icon: "avg" }
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.wrap}>
      {cards.map((card) => (
        <View key={card.key} style={[styles.card, { borderLeftColor: card.color }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${card.color}18` }]}>
            <PosIcon name={card.icon} size={14} color={card.color} />
          </View>
          <Text style={styles.label}>{card.label}</Text>
          <Text style={posType.metric}>{card.value}</Text>
          <Text style={styles.sub}>{card.subtitle}</Text>
          <Text style={[styles.trend, { color: card.color }]}>{card.trend}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { maxHeight: 118, backgroundColor: posColors.bg },
  row: { paddingHorizontal: posSpacing.lg, paddingVertical: posSpacing.md, gap: posSpacing.md },
  card: {
    minWidth: 118,
    paddingHorizontal: posSpacing.md,
    paddingVertical: posSpacing.sm,
    borderRadius: posRadius.md,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border,
    borderLeftWidth: 3
  },
  iconWrap: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  label: { ...posType.label, fontSize: 8 },
  sub: { fontSize: 9, color: posColors.textDim, marginTop: 1 },
  trend: { fontSize: 9, fontWeight: "800", marginTop: 2 }
});
