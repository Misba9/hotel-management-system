import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import { formatOrderTypeLabel, isOrderPaid } from "../../lib/cashier-order-filters";
import { PosButton } from "./pos-ui";
import { posCard, posColors, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  visible: boolean;
  orders: StaffOrderRow[];
  onClose: () => void;
  onReprint: (order: StaffOrderRow) => void;
  onRefund: (order: StaffOrderRow) => void;
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

function formatTime(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return "—";
  return maybe.toDate().toLocaleString();
}

export function TransactionHistoryPanel({ visible, orders, onClose, onReprint, onRefund }: Props) {
  const paidToday = orders.filter((o) => isOrderPaid(o.paymentStatus));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[posCard(true), styles.sheet]}>
          <View style={styles.header}>
            <Text style={posType.h2}>Transaction History</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {paidToday.length === 0 ? (
              <Text style={posType.small}>No completed transactions in view</Text>
            ) : (
              paidToday.slice(0, 50).map((order) => (
                <View key={order.id} style={[posCard(), styles.row]}>
                  <View style={styles.rowTop}>
                    <View>
                      <Text style={styles.orderId}>{order.id.slice(0, 10).toUpperCase()}</Text>
                      <Text style={posType.small}>
                        {formatOrderTypeLabel(order.orderType)} · {formatTime(order.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.amount}>{formatMoney(order.totalAmount)}</Text>
                  </View>
                  <View style={styles.actions}>
                    <PosButton label="Reprint" icon="print" variant="secondary" onPress={() => onReprint(order)} style={{ flex: 1 }} />
                    <PosButton label="Refund" icon="refund" variant="danger" onPress={() => onRefund(order)} style={{ flex: 1 }} />
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "82%",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: posRadius.xl,
    borderTopRightRadius: posRadius.xl,
    overflow: "hidden"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: posSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border
  },
  close: { fontSize: 20, color: posColors.textSecondary, fontWeight: "700" },
  list: { padding: posSpacing.lg, gap: posSpacing.md },
  row: { padding: posSpacing.md, gap: posSpacing.md },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  orderId: { fontSize: 14, fontWeight: "800", color: posColors.text },
  amount: { fontSize: 18, fontWeight: "900", color: posColors.success },
  actions: { flexDirection: "row", gap: posSpacing.sm }
});
