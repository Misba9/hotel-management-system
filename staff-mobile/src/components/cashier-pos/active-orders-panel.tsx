import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import { isOrderPaid, kitchenStatusLabel } from "../../lib/cashier-order-filters";
import { getOrderSourceMeta } from "../../lib/pos/order-source";
import { PosButton, PosEmpty, PosHoverCard } from "./pos-ui";
import { posColors, posPanel, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  orders: StaffOrderRow[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (order: StaffOrderRow) => void;
  onNewOrder: () => void;
  onRefresh: () => void;
  layout?: "sidebar" | "bottom";
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

function formatTimeAgo(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return "—";
  const created = maybe.toDate();
  const diffMs = Date.now() - created.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

function statusColor(status: string, paid: boolean): string {
  const s = status.toLowerCase();
  if (s === "cancelled" || s === "rejected") return posColors.statusCancelled;
  if (paid || s === "completed" || s === "delivered") return posColors.statusCompleted;
  if (s === "ready") return posColors.statusReady;
  if (s === "accepted" || s === "received") return posColors.statusAccepted;
  if (s === "preparing") return posColors.statusPreparing;
  return posColors.warning;
}

export function ActiveOrdersPanel({
  orders,
  loading,
  selectedId,
  onSelect,
  onNewOrder,
  onRefresh,
  layout = "sidebar"
}: Props) {
  const isBottom = layout === "bottom";

  const renderItem = useCallback(
    ({ item: order }: { item: StaffOrderRow }) => {
      const selected = selectedId === order.id;
      const paid = isOrderPaid(order.paymentStatus);
      const meta = getOrderSourceMeta(order);
      const token =
        typeof order.tokenNumber === "number" && order.tokenNumber > 0 ? `#${order.tokenNumber}` : "—";
      const table =
        typeof order.tableNumber === "number" && order.tableNumber > 0
          ? `Table ${order.tableNumber}`
          : order.tableName ?? null;
      const customer = String(
        (order as StaffOrderRow & { customerName?: string }).customerName ?? order.customer?.name ?? "Walk-in"
      );
      const kitchen = kitchenStatusLabel(order.status, order.canonicalStatus);
      const statusText = paid ? "Paid" : kitchen;
      const color = statusColor(kitchen, paid);

      return (
        <PosHoverCard
          selected={selected}
          onPress={() => onSelect(order)}
          style={isBottom ? styles.orderCardBottom : styles.orderCard}
        >
          <Text style={[styles.sourceLabel, { color: meta.color }]}>
            {meta.emoji} {meta.label.toUpperCase()}
          </Text>
          <Text style={styles.token}>Token {token}</Text>
          {table ? <Text style={styles.tableLine}>{table}</Text> : null}
          <Text style={styles.customer} numberOfLines={1}>{customer}</Text>
          <Text style={styles.amount}>{formatMoney(order.totalAmount)}</Text>
          <Text style={styles.items}>{order.items.length} Items</Text>
          <Text style={styles.timeAgo}>{formatTimeAgo(order.createdAt)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
            <Text style={[styles.statusText, { color }]}>{statusText}</Text>
          </View>
        </PosHoverCard>
      );
    },
    [selectedId, onSelect, isBottom]
  );

  return (
    <View style={[posPanel(), styles.panel, isBottom && styles.panelBottom]}>
      <View style={styles.header}>
        <View>
          <Text style={posType.h3}>Live Order Queue</Text>
          <Text style={posType.small}>{orders.length} orders · tap to load bill</Text>
        </View>
        <View style={styles.headerActions}>
          <PosButton label="↻" variant="ghost" onPress={onRefresh} style={styles.iconBtn} />
          {!isBottom ? <PosButton label="New" icon="plus" variant="primary" onPress={onNewOrder} style={styles.newBtn} /> : null}
        </View>
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator color={posColors.primary} size="large" />
        </View>
      ) : orders.length === 0 ? (
        <PosEmpty message="No orders" hint="Create a new Parcel order or adjust filters" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          horizontal={isBottom}
          contentContainerStyle={isBottom ? styles.listBottom : styles.list}
          showsVerticalScrollIndicator={!isBottom}
          showsHorizontalScrollIndicator={isBottom}
          initialNumToRender={isBottom ? 10 : 12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRightWidth: 1 },
  panelBottom: {
    borderRightWidth: 0,
    borderTopWidth: 1,
    borderTopColor: posColors.border,
    maxHeight: 200,
    minHeight: 168,
    flex: 0
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: posSpacing.lg,
    paddingVertical: posSpacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border
  },
  headerActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  newBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 80 },
  list: { padding: posSpacing.md, gap: posSpacing.sm, paddingBottom: posSpacing.huge },
  listBottom: { paddingHorizontal: posSpacing.md, paddingVertical: posSpacing.sm, gap: posSpacing.sm },
  orderCard: { padding: posSpacing.md, marginBottom: 2 },
  orderCardBottom: {
    padding: posSpacing.md,
    minWidth: 168,
    flexGrow: 1,
    minHeight: 148,
    marginRight: posSpacing.sm
  },
  sourceLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  token: { fontSize: 14, fontWeight: "900", color: posColors.text, marginTop: 4 },
  tableLine: { fontSize: 10, fontWeight: "600", color: posColors.textSecondary, marginTop: 2 },
  customer: { fontSize: 10, fontWeight: "600", color: posColors.textDim, marginTop: 1 },
  amount: { fontSize: 18, fontWeight: "900", color: posColors.primary, marginTop: posSpacing.xs },
  items: { fontSize: 10, fontWeight: "700", color: posColors.textSecondary, marginTop: 2 },
  timeAgo: { fontSize: 10, color: posColors.textDim, marginTop: 2 },
  statusBadge: {
    alignSelf: "flex-start",
    marginTop: posSpacing.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: posRadius.pill,
    borderWidth: 1
  },
  statusText: { fontSize: 10, fontWeight: "800" }
});
