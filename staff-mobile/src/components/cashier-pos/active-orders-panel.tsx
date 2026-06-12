import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type TextInput } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import { isOrderPaid, isOrderPendingPayment, kitchenStatusLabel } from "../../lib/cashier-order-filters";
import { getOrderSourceMeta } from "../../lib/pos/order-source";
import type { OrderSourceKey, OrderStatusFilter } from "./pos-types";
import { PosButton, PosChip, PosEmpty, PosHoverCard, PosInput } from "./pos-ui";
import { posColors, posPanel, posSpacing, posType } from "./pos-theme";

const SOURCE_FILTERS: { id: OrderSourceKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "waiter", label: "Waiter" },
  { id: "dine_in", label: "Dine-In" },
  { id: "parcel", label: "Parcel" },
  { id: "swiggy", label: "Swiggy" },
  { id: "zomato", label: "Zomato" },
  { id: "website", label: "Website" },
  { id: "qr", label: "QR" },
  { id: "online", label: "Online" },
  { id: "phone", label: "Phone" }
];

const STATUS_FILTERS: { id: OrderStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "paid", label: "Paid" },
  { id: "completed", label: "Done" },
  { id: "cancelled", label: "Cancelled" }
];

type Props = {
  orders: StaffOrderRow[];
  loading: boolean;
  selectedId: string | null;
  search: string;
  sourceFilter: OrderSourceKey;
  statusFilter: OrderStatusFilter;
  onSearchChange: (v: string) => void;
  onSourceFilter: (v: OrderSourceKey) => void;
  onStatusFilter: (v: OrderStatusFilter) => void;
  onSelect: (order: StaffOrderRow) => void;
  onNewOrder: () => void;
  onRefresh: () => void;
  searchInputRef?: React.Ref<TextInput>;
  /** sidebar = left column; bottom = sticky live queue */
  layout?: "sidebar" | "bottom";
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

function formatTime(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return "—";
  return maybe.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ActiveOrdersPanel({
  orders,
  loading,
  selectedId,
  search,
  sourceFilter,
  statusFilter,
  onSearchChange,
  onSourceFilter,
  onStatusFilter,
  onSelect,
  onNewOrder,
  onRefresh,
  searchInputRef,
  layout = "sidebar"
}: Props) {
  const isBottom = layout === "bottom";
  const renderItem = useCallback(
    ({ item: order }: { item: StaffOrderRow }) => {
      const selected = selectedId === order.id;
      const paid = isOrderPaid(order.paymentStatus);
      const pending = isOrderPendingPayment(order.paymentStatus);
      const meta = getOrderSourceMeta(order);
      const token = typeof order.tokenNumber === "number" && order.tokenNumber > 0 ? `#${order.tokenNumber}` : "—";
      const table =
        typeof order.tableNumber === "number" && order.tableNumber > 0 ? `T${order.tableNumber}` : "—";
      const customer = String((order as StaffOrderRow & { customerName?: string }).customerName ?? order.customer?.name ?? "Walk-in");
      const phone = String((order as StaffOrderRow & { phone?: string }).phone ?? order.customer?.phone ?? "—");
      const kitchen = kitchenStatusLabel(order.status, order.canonicalStatus);

      return (
        <PosHoverCard
          selected={selected}
          onPress={() => onSelect(order)}
          style={isBottom ? styles.orderCardBottom : styles.orderCard}
        >
          <View style={styles.orderTop}>
            <Text style={[styles.source, { color: meta.color }]}>{meta.emoji} {meta.label.toUpperCase()}</Text>
            <Text style={styles.amount}>{formatMoney(order.totalAmount)}</Text>
          </View>
          <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()} · Token {token}</Text>
          {isBottom ? (
            <View style={styles.bottomMeta}>
              <Text style={styles.bottomMetaText} numberOfLines={1}>{customer} · {table} · {order.items.length} items</Text>
              <View style={styles.badges}>
                <Text style={[styles.badge, { color: kitchen === "Ready" ? posColors.success : posColors.warning }]}>{kitchen}</Text>
                <Text style={[styles.badge, { color: paid ? posColors.success : posColors.warning }]}>{paid ? "Paid" : "Pending"}</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.metaGrid}>
                <Meta k="Table" v={table} />
                <Meta k="Customer" v={customer} />
                <Meta k="Phone" v={phone} />
                <Meta k="Items" v={String(order.items.length)} />
                <Meta k="Time" v={formatTime(order.createdAt)} />
                <Meta k="Kitchen" v={kitchen} />
              </View>
              <View style={styles.badges}>
                <Text style={[styles.badge, { color: paid ? posColors.success : posColors.warning }]}>
                  {paid ? "Paid" : pending ? "Pending" : String(order.paymentStatus ?? "—")}
                </Text>
              </View>
            </>
          )}
        </PosHoverCard>
      );
    },
    [selectedId, onSelect, isBottom]
  );

  return (
    <View style={[posPanel(), styles.panel, isBottom && styles.panelBottom]}>
      <View style={styles.header}>
        <View>
          <Text style={posType.h3}>{isBottom ? "Live Order Queue" : "Active Orders"}</Text>
          <Text style={posType.small}>{orders.length} orders · tap to load bill</Text>
        </View>
        <View style={styles.headerActions}>
          <PosButton label="↻" variant="ghost" onPress={onRefresh} style={styles.iconBtn} />
          {!isBottom ? <PosButton label="New" icon="plus" variant="primary" onPress={onNewOrder} style={styles.newBtn} /> : null}
        </View>
      </View>

      {!isBottom ? (
        <View style={styles.searchWrap}>
          <PosInput ref={searchInputRef} value={search} onChangeText={onSearchChange} placeholder="Search orders…" style={styles.search} />
        </View>
      ) : null}

      <FlatList
        horizontal
        data={SOURCE_FILTERS}
        keyExtractor={(f) => f.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        renderItem={({ item: f }) => <PosChip label={f.label} active={sourceFilter === f.id} onPress={() => onSourceFilter(f.id)} />}
      />
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(f) => f.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips, { paddingTop: 0 }]}
        renderItem={({ item: f }) => (
          <PosChip label={f.label} active={statusFilter === f.id} color={f.id === "paid" ? posColors.success : f.id === "pending" ? posColors.warning : posColors.primary} onPress={() => onStatusFilter(f.id)} />
        )}
      />

      {loading && orders.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator color={posColors.primary} size="large" />
        </View>
      ) : orders.length === 0 ? (
        <PosEmpty message="No orders" hint="Adjust filters or create new order" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          horizontal={isBottom}
          contentContainerStyle={isBottom ? styles.listBottom : styles.list}
          showsVerticalScrollIndicator={!isBottom}
          showsHorizontalScrollIndicator={isBottom}
          initialNumToRender={isBottom ? 8 : 12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaK}>{k}</Text>
      <Text style={styles.metaV} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRightWidth: 1 },
  panelBottom: {
    borderRightWidth: 0,
    borderTopWidth: 1,
    borderTopColor: posColors.border,
    maxHeight: 220,
    minHeight: 180,
    flex: 0
  },
  header: { flexDirection: "row", justifyContent: "space-between", padding: posSpacing.lg, borderBottomWidth: 1, borderBottomColor: posColors.border },
  headerActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  newBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  searchWrap: { paddingHorizontal: posSpacing.lg, paddingTop: posSpacing.md },
  search: {},
  chips: { paddingHorizontal: posSpacing.lg, paddingVertical: posSpacing.sm, gap: posSpacing.sm },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: posSpacing.md, gap: posSpacing.sm, paddingBottom: posSpacing.huge },
  listBottom: { paddingHorizontal: posSpacing.md, paddingVertical: posSpacing.sm, gap: posSpacing.sm },
  orderCard: { padding: posSpacing.md, marginBottom: 2 },
  orderCardBottom: { padding: posSpacing.md, marginBottom: 2, width: 260, minHeight: 120, marginRight: posSpacing.sm },
  bottomMeta: { marginTop: posSpacing.sm, gap: 4 },
  bottomMetaText: { fontSize: 11, color: posColors.textSecondary, fontWeight: "600" },
  orderTop: { flexDirection: "row", justifyContent: "space-between" },
  source: { fontSize: 12, fontWeight: "800" },
  amount: { fontSize: 18, fontWeight: "900", color: posColors.text },
  orderId: { fontSize: 11, color: posColors.textDim, marginTop: 4, fontWeight: "700" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: posSpacing.sm, gap: 6 },
  metaCell: { width: "47%" },
  metaK: { fontSize: 8, fontWeight: "700", color: posColors.textDim, textTransform: "uppercase" },
  metaV: { fontSize: 11, fontWeight: "600", color: posColors.textSecondary },
  badges: { marginTop: posSpacing.sm },
  badge: { fontSize: 10, fontWeight: "800" }
});
