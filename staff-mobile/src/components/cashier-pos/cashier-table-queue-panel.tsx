import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCashierTablePaymentQueue, type CashierQueueOrder } from "../../hooks/use-cashier-table-payment-queue";
import { cashierRequestTableBill, formatCashierRequestBillError } from "../../services/cashier-request-table-bill";
import { confirmTableOrderPayment, formatConfirmPaymentError } from "../../services/confirm-table-order-payment";
import { space, radius } from "../../theme/design-tokens";
import { staffColors, cardShadow } from "../../theme/staff-ui";

type Props = {
  enabled?: boolean;
};

function paymentUpper(p: string) {
  return p.trim().toUpperCase();
}

function OrderRow({
  order,
  billBusy,
  payBusy,
  onRequestBill,
  onMarkPaid
}: {
  order: CashierQueueOrder;
  billBusy: boolean;
  payBusy: boolean;
  onRequestBill: (id: string) => void;
  onMarkPaid: (id: string) => void;
}) {
  const pay = paymentUpper(order.paymentStatus);
  const st = paymentUpper(order.status);
  const showRequestBill = pay === "PENDING";
  const queueReason = pay === "REQUESTED" ? "Bill requested" : st === "SERVED" ? "Served · awaiting payment" : "Awaiting payment";

  return (
    <View style={[styles.card, cardShadow()]}>
      <View style={styles.cardTop}>
        <Text style={styles.table}>Table {order.tableNumber || "—"}</Text>
        <View style={styles.reasonPill}>
          <Text style={styles.reasonText}>{queueReason}</Text>
        </View>
      </View>
      <Text style={styles.idMeta} numberOfLines={1}>
        #{order.id.slice(0, 12)}…
      </Text>

      <Text style={styles.itemsHeading}>Items</Text>
      {order.items.length === 0 ? (
        <Text style={styles.itemLine}>—</Text>
      ) : (
        order.items.map((line, i) => (
          <Text key={`${order.id}-l-${i}`} style={styles.itemLine}>
            {line.name} × {line.quantity}
            {line.price > 0 ? ` · ₹${line.price.toFixed(0)}` : ""}
          </Text>
        ))
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>₹{order.totalAmount.toFixed(0)}</Text>
      </View>

      <View style={styles.actions}>
        {showRequestBill ? (
          <Pressable
            onPress={() => onRequestBill(order.id)}
            disabled={billBusy}
            style={({ pressed }) => [
              styles.btnSecondary,
              billBusy && styles.btnDisabled,
              pressed && !billBusy && styles.pressed
            ]}
          >
            {billBusy ? (
              <ActivityIndicator color={staffColors.accent} />
            ) : (
              <Text style={styles.btnSecondaryText}>Request bill</Text>
            )}
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => onMarkPaid(order.id)}
          disabled={payBusy}
          style={({ pressed }) => [
            styles.btnPrimary,
            payBusy && styles.btnDisabled,
            pressed && !payBusy && styles.pressed
          ]}
        >
          {payBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnPrimaryText}>Mark paid</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function CashierTableQueuePanel({ enabled = true }: Props) {
  const { orders, loading, error } = useCashierTablePaymentQueue(enabled);
  const [billId, setBillId] = useState<string | null>(null);
  const [paidId, setPaidId] = useState<string | null>(null);

  const onRequestBill = useCallback(async (orderId: string) => {
    setBillId(orderId);
    try {
      await cashierRequestTableBill(orderId);
    } catch (e) {
      Alert.alert("Could not request bill", formatCashierRequestBillError(e));
    } finally {
      setBillId(null);
    }
  }, []);

  const onMarkPaid = useCallback(async (orderId: string) => {
    setPaidId(orderId);
    try {
      await confirmTableOrderPayment(orderId);
      Alert.alert("Payment recorded", "Order completed and table freed.");
    } catch (e) {
      Alert.alert("Could not mark paid", formatConfirmPaymentError(e));
    } finally {
      setPaidId(null);
    }
  }, []);

  if (!enabled) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Table payments</Text>
      <Text style={styles.subtitle}>
        Live queue: bill requested or served and unpaid. Request bill if needed, then mark paid when settled.
      </Text>

      {loading && orders.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={staffColors.accent} />
          <Text style={styles.loadingText}>Syncing orders…</Text>
        </View>
      ) : error && orders.length === 0 ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing in queue</Text>
          <Text style={styles.emptyBody}>Orders appear when payment is REQUESTED or the table is SERVED.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listScroll}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {orders.map((item) => (
            <OrderRow
              key={item.id}
              order={item}
              billBusy={billId === item.id}
              payBusy={paidId === item.id}
              onRequestBill={onRequestBill}
              onMarkPaid={onMarkPaid}
            />
          ))}
          <View style={{ height: space.md }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    maxHeight: 340,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: staffColors.border,
    backgroundColor: staffColors.surface
  },
  listScroll: { flexGrow: 0 },
  title: { fontSize: 20, fontWeight: "900", color: staffColors.text, letterSpacing: -0.3 },
  subtitle: { marginTop: space.xs, fontSize: 13, color: staffColors.muted, lineHeight: 18, marginBottom: space.md },
  center: { paddingVertical: space.xl, alignItems: "center" },
  loadingText: { marginTop: space.sm, fontSize: 14, color: staffColors.muted, fontWeight: "600" },
  errorText: { color: staffColors.danger, fontSize: 14, paddingVertical: space.lg },
  empty: { paddingVertical: space.lg, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: staffColors.text },
  emptyBody: { marginTop: space.sm, fontSize: 14, color: staffColors.muted, textAlign: "center" },
  card: {
    backgroundColor: staffColors.bg,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  table: { fontSize: 18, fontWeight: "900", color: staffColors.text, flex: 1 },
  reasonPill: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.full
  },
  reasonText: { fontSize: 10, fontWeight: "800", color: "#B45309", letterSpacing: 0.2 },
  idMeta: { marginTop: 4, fontSize: 12, color: staffColors.muted, fontWeight: "600" },
  itemsHeading: {
    marginTop: space.md,
    fontSize: 11,
    fontWeight: "800",
    color: staffColors.muted,
    letterSpacing: 0.4
  },
  itemLine: { marginTop: 6, fontSize: 14, color: staffColors.text, fontWeight: "600" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: staffColors.border
  },
  totalLabel: { fontSize: 14, color: staffColors.muted, fontWeight: "700" },
  totalValue: { fontSize: 22, fontWeight: "900", color: staffColors.accent },
  actions: { marginTop: space.md, flexDirection: "row", gap: space.sm },
  btnPrimary: {
    flex: 1,
    backgroundColor: staffColors.success,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  btnPrimaryWide: { flex: 1 },
  btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  btnSecondary: {
    flex: 1,
    backgroundColor: staffColors.surface,
    borderWidth: 2,
    borderColor: staffColors.accent,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  btnSecondaryText: { color: staffColors.accent, fontWeight: "900", fontSize: 15 },
  btnDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.9 }
});
