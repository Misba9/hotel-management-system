import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
import type { StaffOrderRow } from "../../../services/orders";
import { isOrderPaid, kitchenStatusLabel } from "../../lib/cashier-order-filters";
import { getOrderSourceMeta, isOrderCancelled } from "../../lib/pos/order-source";
import type { OrderStatusFilter } from "../../lib/pos/order-source";
import type { PlatformTab } from "../../lib/pos/cashier-pos-store";
import { PosPlatformStatusFilter } from "./pos-platform-status-filter";
import { PosIcon } from "./pos-icons";
import { PosButton, PosEmpty, PosInput } from "./pos-ui";
import { posCard, posColors, posPanel, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  platform: PlatformTab;
  orders: StaffOrderRow[];
  loading: boolean;
  search: string;
  statusFilter: OrderStatusFilter;
  statusCounts: Record<OrderStatusFilter, number>;
  onStatusChange: (status: OrderStatusFilter) => void;
  onSearchChange: (q: string) => void;
  onOpenOrder: (order: StaffOrderRow) => void;
  onRefresh: () => void;
  onAccept?: (order: StaffOrderRow) => void;
  onReject?: (order: StaffOrderRow) => void;
  onPrint?: (order: StaffOrderRow) => void;
  onAssignKitchen?: (order: StaffOrderRow) => void;
  onMarkReady?: (order: StaffOrderRow) => void;
  onMarkDelivered?: (order: StaffOrderRow) => void;
  onPayment?: (order: StaffOrderRow) => void;
  onClose?: (order: StaffOrderRow) => void;
};

const PLATFORM_TITLES: Record<PlatformTab, string> = {
  parcel: "Parcel Orders",
  swiggy: "Swiggy Orders",
  zomato: "Zomato Orders",
  online: "Online Orders",
  waiter: "Waiter Orders"
};

const PLATFORM_HINTS: Record<Exclude<PlatformTab, "parcel">, string> = {
  swiggy: "Linked Swiggy Merchant Account · Auto Sync · Real Time",
  zomato: "Linked Zomato Merchant Account · Auto Sync · Real Time",
  online: "Customer Website & Mobile App · Auto Sync · Real Time",
  waiter: "Orders from Staff App · Real Time"
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

function formatTime(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return "—";
  return maybe.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusColor(status: string, paid: boolean, cancelled: boolean): string {
  if (cancelled) return posColors.statusCancelled;
  if (paid) return posColors.statusCompleted;
  const s = status.toLowerCase();
  if (s === "ready") return posColors.statusReady;
  if (s === "preparing") return posColors.statusPreparing;
  return posColors.warning;
}

function getCustomer(order: StaffOrderRow) {
  return String(
    (order as StaffOrderRow & { customerName?: string }).customerName ?? order.customer?.name ?? "Guest"
  );
}

function getDeliveryType(order: StaffOrderRow) {
  const ot = String(order.orderType ?? "").toLowerCase();
  if (ot.includes("pickup") || ot.includes("parcel")) return "Pickup";
  return "Delivery";
}

export function PosPlatformOrdersPanel({
  platform,
  orders,
  loading,
  search,
  statusFilter,
  statusCounts,
  onStatusChange,
  onSearchChange,
  onOpenOrder,
  onRefresh,
  onAccept,
  onReject,
  onPrint,
  onAssignKitchen,
  onMarkReady,
  onMarkDelivered,
  onPayment,
  onClose
}: Props) {
  const layout = useResponsiveLayout();
  const isPhone = layout.isPhone;
  const isTabletOnly = layout.isSmallTablet;
  const title = PLATFORM_TITLES[platform];
  const hint = platform !== "parcel" ? PLATFORM_HINTS[platform] : undefined;

  const renderActions = useCallback(
    (order: StaffOrderRow) => {
      const cancelled = isOrderCancelled(order);
      if (cancelled) {
        return (
          <View style={styles.actions}>
            <PosButton label="View" variant="secondary" onPress={() => onOpenOrder(order)} style={styles.actionBtn} />
          </View>
        );
      }

      if (platform === "waiter") {
        return (
          <View style={styles.actions}>
            <PosButton label="Open" variant="secondary" onPress={() => onOpenOrder(order)} style={styles.actionBtn} />
            <PosButton label="Kitchen" variant="secondary" onPress={() => onAssignKitchen?.(order)} style={styles.actionBtn} />
            <PosButton label="Payment" variant="primary" onPress={() => onPayment?.(order)} style={styles.actionBtn} />
            <PosButton label="Print" variant="ghost" onPress={() => onPrint?.(order)} style={styles.actionBtn} />
            <PosButton label="Close" variant="danger" onPress={() => onClose?.(order)} style={styles.actionBtn} />
          </View>
        );
      }

      return (
        <View style={styles.actions}>
          <PosButton label="View" variant="secondary" onPress={() => onOpenOrder(order)} style={styles.actionBtn} />
          <PosButton label="Accept" variant="primary" onPress={() => onAccept?.(order)} style={styles.actionBtn} />
          <PosButton label="Reject" variant="danger" onPress={() => onReject?.(order)} style={styles.actionBtn} />
          <PosButton label="Print" variant="ghost" onPress={() => onPrint?.(order)} style={styles.actionBtn} />
          <PosButton label="Kitchen" variant="secondary" onPress={() => onAssignKitchen?.(order)} style={styles.actionBtn} />
          <PosButton label="Ready" variant="secondary" onPress={() => onMarkReady?.(order)} style={styles.actionBtn} />
          {(platform === "swiggy" || platform === "zomato" || platform === "online") && (
            <PosButton label="Delivered" variant="secondary" onPress={() => onMarkDelivered?.(order)} style={styles.actionBtn} />
          )}
        </View>
      );
    },
    [platform, onOpenOrder, onAccept, onReject, onPrint, onAssignKitchen, onMarkReady, onMarkDelivered, onPayment, onClose]
  );

  const renderItem = useCallback(
    ({ item: order }: { item: StaffOrderRow }) => {
      const cancelled = isOrderCancelled(order);
      const paid = isOrderPaid(order.paymentStatus);
      const kitchen = kitchenStatusLabel(order.status, order.canonicalStatus);
      const statusText = cancelled ? "Cancelled" : paid ? "Paid" : kitchen;
      const color = statusColor(kitchen, paid, cancelled);
      const meta = getOrderSourceMeta(order);
      const raw = order as StaffOrderRow & Record<string, unknown>;
      const waiterName = typeof raw.waiterName === "string" ? raw.waiterName : "Staff";
      const guestCount = typeof raw.guestCount === "number" ? raw.guestCount : null;
      const tableNum =
        typeof order.tableNumber === "number" && order.tableNumber > 0 ? order.tableNumber : null;

      return (
        <View style={[posCard(), styles.card, cancelled && styles.cardCancelled]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderId}>#{order.id.slice(0, 10).toUpperCase()}</Text>
              {platform === "waiter" ? (
                <>
                  <Text style={styles.waiterLine}>👨 {waiterName}</Text>
                  {tableNum ? <Text style={styles.metaLine}>Table {tableNum}</Text> : null}
                  {guestCount ? <Text style={styles.metaLine}>{guestCount} Guests</Text> : null}
                </>
              ) : (
                <Text style={styles.customer} numberOfLines={1}>{getCustomer(order)}</Text>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
              <Text style={[styles.statusText, { color }]}>{statusText}</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.itemsLine}>{order.items.length} Items · {formatMoney(order.totalAmount)}</Text>
            {platform === "online" ? (
              <Text style={styles.metaLine}>{getDeliveryType(order)}</Text>
            ) : null}
            <Text style={styles.metaLine}>
              Payment: {paid ? "Paid" : String(order.paymentStatus ?? "Pending")}
            </Text>
            <Text style={styles.timeLine}>{formatTime(order.createdAt)}</Text>
          </View>

          {cancelled ? (
            <View style={styles.cancelledInfo}>
              <Text style={styles.cancelledText}>
                Cancelled by {String(raw.cancelledBy ?? "System")} · {String(raw.cancelReason ?? "—")}
              </Text>
              <Text style={styles.cancelledPlatform}>{meta.emoji} {meta.label}</Text>
            </View>
          ) : null}

          {renderActions(order)}
        </View>
      );
    },
    [platform, renderActions]
  );

  const header = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.header}>
          <View>
            <Text style={posType.h2}>{title}</Text>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            <Text style={posType.small}>{orders.length} orders</Text>
          </View>
          <PosButton label="↻" variant="ghost" onPress={onRefresh} style={styles.refreshBtn} />
        </View>
        <View style={[styles.filtersRow, isPhone && styles.filtersRowStacked]}>
          <View
            style={[
              styles.searchField,
              !isPhone && (isTabletOnly ? styles.searchFieldTablet : styles.searchFieldFlex)
            ]}
          >
            <PosIcon name="search" size={layout.iconSize * 0.85} color={posColors.textDim} />
            <PosInput
              placeholder="Search Order"
              value={search}
              onChangeText={onSearchChange}
              style={styles.searchInput}
            />
          </View>
          <View style={!isPhone && isTabletOnly ? styles.statusSlotTablet : undefined}>
            <PosPlatformStatusFilter
              platform={platform}
              activeStatus={statusFilter}
              statusCounts={statusCounts}
              onStatusChange={onStatusChange}
              fullWidth={isPhone}
            />
          </View>
        </View>
      </View>
    ),
    [title, hint, orders.length, search, onSearchChange, onRefresh, platform, statusFilter, statusCounts, onStatusChange, isPhone, isTabletOnly, layout.iconSize]
  );

  if (loading && orders.length === 0) {
    return (
      <View style={[posPanel(), styles.panel]}>
        {header}
        <View style={styles.loader}>
          <ActivityIndicator color={posColors.primary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={[posPanel(), styles.panel]}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<PosEmpty message="No orders" hint="Orders will appear here when synced" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  headerBlock: { paddingBottom: posSpacing.sm },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: posSpacing.lg,
    paddingTop: posSpacing.lg
  },
  hint: { fontSize: 11, color: posColors.textDim, marginTop: 2, fontStyle: "italic" },
  refreshBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    paddingHorizontal: posSpacing.lg,
    paddingTop: posSpacing.md
  },
  filtersRowStacked: {
    flexDirection: "column",
    alignItems: "stretch"
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    backgroundColor: posColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: posColors.borderStrong,
    paddingHorizontal: posSpacing.md,
    minHeight: 40
  },
  searchFieldFlex: {
    flex: 1,
    minWidth: 0
  },
  searchFieldTablet: {
    flex: 7,
    minWidth: 0
  },
  statusSlotTablet: {
    flex: 3,
    minWidth: 150,
    maxWidth: 180
  },
  searchInput: { flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingVertical: 8, fontSize: 14 },
  list: { paddingHorizontal: posSpacing.lg, paddingBottom: posSpacing.huge, gap: posSpacing.md },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200 },
  card: {
    padding: posSpacing.lg,
    borderRadius: posRadius.lg,
    marginBottom: posSpacing.sm
  },
  cardCancelled: {
    borderColor: posColors.statusCancelled,
    backgroundColor: "rgba(239,68,68,0.08)"
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderId: { fontSize: 13, fontWeight: "900", color: posColors.text, letterSpacing: 0.5 },
  customer: { fontSize: 14, fontWeight: "700", color: posColors.textSecondary, marginTop: 4 },
  waiterLine: { fontSize: 15, fontWeight: "800", color: posColors.text, marginTop: 4 },
  metaLine: { fontSize: 12, fontWeight: "600", color: posColors.textDim, marginTop: 2 },
  cardBody: { marginTop: posSpacing.sm },
  itemsLine: { fontSize: 16, fontWeight: "900", color: posColors.primary },
  timeLine: { fontSize: 12, color: posColors.textDim, marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: posRadius.pill,
    borderWidth: 1
  },
  statusText: { fontSize: 11, fontWeight: "800" },
  cancelledInfo: {
    marginTop: posSpacing.sm,
    padding: posSpacing.sm,
    borderRadius: posRadius.sm,
    backgroundColor: "rgba(239,68,68,0.12)"
  },
  cancelledText: { fontSize: 11, color: posColors.statusCancelled, fontWeight: "600" },
  cancelledPlatform: { fontSize: 10, color: posColors.textDim, marginTop: 2 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: posSpacing.md,
    paddingTop: posSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: posColors.border
  },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10 }
});
