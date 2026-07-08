import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
import type { StaffOrderRow } from "../../../services/orders";
import { isOrderPaid, kitchenStatusLabel } from "../../lib/cashier-order-filters";
import { isOrderCancelled } from "../../lib/pos/order-source";
import {
  formatParcelTime,
  orderCardAccent,
  searchParcelOrders,
  type ParcelDateFilter
} from "../../lib/pos/parcel-recent-orders";
import { PosButton, PosChip, PosEmpty, PosInput } from "./pos-ui";
import { posCard, posColors, posGlass, posRadius, posShadow, posSpacing, posType } from "./pos-theme";

const DATE_FILTERS: { id: ParcelDateFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This Week" },
  { id: "all", label: "All" }
];

const CANCEL_REASONS = [
  "Customer Cancelled",
  "Duplicate",
  "Wrong Entry",
  "Other"
] as const;

const ACCENT_COLORS = {
  hold: posColors.warning,
  paid: posColors.success,
  preparing: posColors.info,
  cancelled: posColors.statusCancelled
};

type Props = {
  visible: boolean;
  orders: StaffOrderRow[];
  loading: boolean;
  todayCount: number;
  onClose: () => void;
  onOpen: (order: StaffOrderRow) => void;
  onEdit: (order: StaffOrderRow) => void;
  onPrint: (order: StaffOrderRow) => void;
  onDuplicate: (order: StaffOrderRow) => void;
  onCancel: (order: StaffOrderRow, reason: string) => void;
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

export function PosRecentParcelDrawer({
  visible,
  orders,
  loading,
  todayCount,
  onClose,
  onOpen,
  onEdit,
  onPrint,
  onDuplicate,
  onCancel
}: Props) {
  const layout = useResponsiveLayout();
  const drawerWidth = layout.isPhone ? layout.width : layout.isSmallTablet ? layout.width * 0.8 : layout.width * 0.45;

  const slideAnim = useRef(new Animated.Value(drawerWidth)).current;
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<ParcelDateFilter>("today");
  const [cancelTarget, setCancelTarget] = useState<StaffOrderRow | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220
      }).start();
    } else {
      slideAnim.setValue(drawerWidth);
      setSearch("");
      setCancelTarget(null);
    }
  }, [visible, drawerWidth, slideAnim]);

  const filtered = useMemo(
    () => searchParcelOrders(orders, search, dateFilter),
    [orders, search, dateFilter]
  );

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: drawerWidth,
      duration: 220,
      useNativeDriver: true
    }).start(() => onClose());
  }, [drawerWidth, onClose, slideAnim]);

  const renderItem = useCallback(
    ({ item: order }: { item: StaffOrderRow }) => {
      const accent = orderCardAccent(order);
      const borderColor = ACCENT_COLORS[accent];
      const paid = isOrderPaid(order.paymentStatus);
      const cancelled = isOrderCancelled(order);
      const token =
        typeof order.tokenNumber === "number" && order.tokenNumber > 0
          ? order.tokenNumber
          : "—";
      const customer = String(
        (order as StaffOrderRow & { customerName?: string }).customerName ??
          order.customer?.name ??
          "Walk-in Customer"
      );
      const phone = String(order.customer?.phone ?? "—");
      const kitchen = kitchenStatusLabel(order.status, order.canonicalStatus);
      const paymentLabel = paid ? "Paid" : String(order.paymentStatus ?? "Pending");
      const statusLabel = cancelled ? "Cancelled" : paid ? "Paid" : kitchen;

      return (
        <View style={[posCard(), styles.card, { borderLeftWidth: 4, borderLeftColor: borderColor }]}>
          <View style={styles.cardTop}>
            <Text style={styles.token}>📦 Token #{token}</Text>
            <View style={[styles.statusPill, { backgroundColor: `${borderColor}22`, borderColor: `${borderColor}55` }]}>
              <Text style={[styles.statusPillText, { color: borderColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.customer}>{customer}</Text>
          {phone !== "—" ? <Text style={styles.phone}>{phone}</Text> : null}
          <Text style={styles.meta}>
            {order.items.length} Items · {formatMoney(order.totalAmount)} · {formatParcelTime(order.createdAt)}
          </Text>
          <Text style={styles.payment}>Payment: {paymentLabel}</Text>

          <View style={styles.actions}>
            <ActionBtn emoji="👁" label="Open" onPress={() => { onOpen(order); handleClose(); }} />
            <ActionBtn emoji="🖨" label="Print" onPress={() => onPrint(order)} />
            <ActionBtn emoji="✏" label="Edit" onPress={() => { onEdit(order); handleClose(); }} />
            {!cancelled ? (
              <ActionBtn emoji="🗑" label="Cancel" onPress={() => setCancelTarget(order)} danger />
            ) : null}
            <ActionBtn emoji="🔄" label="Duplicate" onPress={() => { onDuplicate(order); handleClose(); }} />
          </View>
        </View>
      );
    },
    [onOpen, onEdit, onPrint, onDuplicate, handleClose]
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={handleClose} />
        <Animated.View
          style={[
            styles.drawer,
            posGlass(),
            posShadow(true),
            {
              width: drawerWidth,
              height: layout.height,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={posType.h2}>🕒 Recent Parcel Orders</Text>
              <Text style={posType.small}>{todayCount} today · {filtered.length} shown</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <PosInput
              placeholder="Search by token, name, phone…"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.filters}>
            {DATE_FILTERS.map((f) => (
              <PosChip
                key={f.id}
                label={f.label}
                active={dateFilter === f.id}
                color={posColors.primary}
                onPress={() => setDateFilter(f.id)}
              />
            ))}
          </View>

          <Text style={styles.sortLabel}>Sort: Newest First</Text>

          {loading && filtered.length === 0 ? (
            <View style={styles.loader}>
              <ActivityIndicator color={posColors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(o) => o.id}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <PosEmpty message="No parcel orders" hint="Try another date filter or create a new order" />
              }
            />
          )}
        </Animated.View>
      </View>

      <Modal visible={cancelTarget !== null} transparent animationType="fade">
        <View style={styles.cancelBackdrop}>
          <View style={[posCard(), styles.cancelModal]}>
            <Text style={posType.h3}>Cancel this order?</Text>
            <Text style={posType.small}>Select a reason</Text>
            {CANCEL_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={styles.reasonRow}
                onPress={() => {
                  if (cancelTarget) onCancel(cancelTarget, reason);
                  setCancelTarget(null);
                }}
              >
                <Text style={styles.reasonText}>{reason}</Text>
              </Pressable>
            ))}
            <PosButton label="Keep Order" variant="ghost" onPress={() => setCancelTarget(null)} fullWidth />
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function ActionBtn({
  emoji,
  label,
  onPress,
  danger
}: {
  emoji: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionBtn, danger && styles.actionBtnDanger]}
    >
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <Text style={[styles.actionLabel, danger && { color: posColors.statusCancelled }]}>{label}</Text>
    </Pressable>
  );
}

export function RecentParcelOrdersButton({
  count,
  onPress
}: {
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.recentBtn}>
      <Text style={styles.recentEmoji}>🕒</Text>
      <Text style={styles.recentLabel}>Recent Orders</Text>
      <View style={styles.recentBadge}>
        <Text style={styles.recentBadgeText}>{count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.55)" },
  backdropTap: { flex: 1 },
  drawer: {
    borderLeftWidth: 1,
    borderLeftColor: posColors.borderStrong,
    paddingTop: posSpacing.lg
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: posSpacing.lg,
    paddingBottom: posSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: posColors.card,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: { fontSize: 16, fontWeight: "700", color: posColors.textSecondary },
  searchWrap: { paddingHorizontal: posSpacing.lg, paddingTop: posSpacing.md },
  searchInput: { width: "100%" },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: posSpacing.lg,
    paddingVertical: posSpacing.md
  },
  sortLabel: {
    ...posType.label,
    paddingHorizontal: posSpacing.lg,
    marginBottom: posSpacing.sm,
    color: posColors.textDim
  },
  list: { paddingHorizontal: posSpacing.lg, paddingBottom: posSpacing.huge, gap: posSpacing.md },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: posSpacing.lg, marginBottom: posSpacing.sm },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  token: { fontSize: 15, fontWeight: "900", color: posColors.text },
  customer: { fontSize: 14, fontWeight: "700", color: posColors.textSecondary, marginTop: 6 },
  phone: { fontSize: 12, color: posColors.textDim, marginTop: 2 },
  meta: { fontSize: 16, fontWeight: "900", color: posColors.primary, marginTop: 8 },
  payment: { fontSize: 11, fontWeight: "600", color: posColors.textDim, marginTop: 4 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: posRadius.pill,
    borderWidth: 1
  },
  statusPillText: { fontSize: 10, fontWeight: "800" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: posSpacing.md,
    paddingTop: posSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: posColors.border
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: posRadius.md,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  actionBtnDanger: { borderColor: `${posColors.statusCancelled}44` },
  actionEmoji: { fontSize: 12 },
  actionLabel: { fontSize: 11, fontWeight: "700", color: posColors.text },
  cancelBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: posSpacing.lg
  },
  cancelModal: { width: "100%", maxWidth: 360, padding: posSpacing.xl, gap: 8 },
  reasonRow: {
    paddingVertical: 14,
    paddingHorizontal: posSpacing.md,
    borderRadius: posRadius.md,
    backgroundColor: posColors.secondary,
    marginTop: 4
  },
  reasonText: { fontSize: 14, fontWeight: "600", color: posColors.text },
  recentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: posRadius.pill,
    backgroundColor: posColors.card,
    borderWidth: 1.5,
    borderColor: posColors.primary,
    ...posShadow()
  },
  recentEmoji: { fontSize: 16 },
  recentLabel: { fontSize: 13, fontWeight: "800", color: posColors.text },
  recentBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: posColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  recentBadgeText: { fontSize: 11, fontWeight: "900", color: "#fff" }
});
