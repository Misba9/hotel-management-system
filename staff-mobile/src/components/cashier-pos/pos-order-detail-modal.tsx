import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import { formatOrderTypeLabel, isOrderPaid, kitchenStatusLabel } from "../../lib/cashier-order-filters";
import { getOrderSourceMeta, isOrderCancelled } from "../../lib/pos/order-source";
import { PosButton, PosDivider } from "./pos-ui";
import { posCard, posColors, posGlass, posRadius, posShadow, posSpacing, posType } from "./pos-theme";

type Props = {
  visible: boolean;
  order: StaffOrderRow | null;
  busy?: boolean;
  onClose: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onSendKitchen?: () => void;
  onReady?: () => void;
  onPayment?: () => void;
  onPrint?: () => void;
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function formatDateTime(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return "—";
  return maybe.toDate().toLocaleString();
}

const TIMELINE_STEPS = ["Created", "Accepted", "Preparing", "Ready", "Completed"] as const;

function timelineIndex(status: string): number {
  const s = status.toLowerCase();
  if (s === "completed" || s === "delivered" || s === "served") return 4;
  if (s === "ready") return 3;
  if (s === "preparing" || s === "accepted") return 2;
  if (s === "placed" || s === "pending") return 1;
  return 0;
}

export function PosOrderDetailModal({
  visible,
  order,
  busy,
  onClose,
  onAccept,
  onReject,
  onSendKitchen,
  onReady,
  onPayment,
  onPrint
}: Props) {
  const { width, height } = useWindowDimensions();
  const modalW = Math.min(width * 0.9, 1400);
  const modalH = height * 0.9;

  const meta = useMemo(() => (order ? getOrderSourceMeta(order) : null), [order]);
  const cancelled = order ? isOrderCancelled(order) : false;
  const paid = order ? isOrderPaid(order.paymentStatus) : false;
  const status = order ? kitchenStatusLabel(order.status, order.canonicalStatus) : "—";
  const activeStep = order ? timelineIndex(String(order.canonicalStatus ?? order.status ?? "")) : 0;

  if (!order) return null;

  const customer = String(
    (order as StaffOrderRow & { customerName?: string }).customerName ?? order.customer?.name ?? "Walk-in"
  );
  const phone = String((order as StaffOrderRow & { phone?: string }).phone ?? order.customer?.phone ?? "—");
  const address = String(order.customer?.address ?? (order as StaffOrderRow & { address?: string }).address ?? "—");
  const gst = String((order as StaffOrderRow & { gstNumber?: string }).gstNumber ?? "—");
  const notes = String((order as StaffOrderRow & { notes?: string }).notes ?? "—");
  const subtotal = order.totalAmount;
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = subtotal + tax;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modal, posGlass(), posShadow(true), { width: modalW, height: modalH }]}>
          <View style={styles.modalHeader}>
            <Text style={posType.h1}>Order Details</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={styles.leftCol}>
              <Text style={posType.label}>Order Timeline</Text>
              {TIMELINE_STEPS.map((step, i) => {
                const done = i <= activeStep;
                const current = i === activeStep;
                return (
                  <View key={step} style={styles.timelineRow}>
                    <View style={[styles.timelineDot, done && styles.timelineDotDone, current && styles.timelineDotCurrent]} />
                    <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>{step}</Text>
                  </View>
                );
              })}

              <PosDivider />

              <View style={[posCard(), styles.infoBlock]}>
                <InfoRow label="Status" value={cancelled ? "Cancelled" : status} highlight={cancelled ? posColors.statusCancelled : undefined} />
                <InfoRow label="Platform" value={`${meta?.emoji ?? ""} ${meta?.label ?? "—"}`} />
                <InfoRow label="Order ID" value={order.id.slice(0, 12).toUpperCase()} />
                <InfoRow label="Created" value={formatDateTime(order.createdAt)} />
                <InfoRow label="Kitchen" value={status} />
                {cancelled ? (
                  <>
                    <InfoRow
                      label="Cancelled By"
                      value={String((order as StaffOrderRow & Record<string, unknown>).cancelledBy ?? "—")}
                      highlight={posColors.statusCancelled}
                    />
                    <InfoRow
                      label="Reason"
                      value={String((order as StaffOrderRow & Record<string, unknown>).cancelReason ?? "—")}
                    />
                  </>
                ) : null}
              </View>
            </View>

            <ScrollView style={styles.centerCol} showsVerticalScrollIndicator={false}>
              <Text style={posType.label}>Items</Text>
              <View style={[posCard(), styles.itemsBlock]}>
                {order.items.map((item, idx) => (
                  <View key={`${item.id}-${idx}`} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>Qty {item.qty} · {formatMoney(item.price)}</Text>
                    </View>
                    <Text style={styles.itemTotal}>{formatMoney(item.price * item.qty)}</Text>
                  </View>
                ))}

                <PosDivider />

                <View style={styles.totals}>
                  <TotalRow label="Subtotal" value={formatMoney(subtotal)} />
                  <TotalRow label="Discount" value="₹0.00" />
                  <TotalRow label="Tax (5%)" value={formatMoney(tax)} />
                  <TotalRow label="Grand Total" value={formatMoney(grandTotal)} bold />
                </View>
              </View>
            </ScrollView>

            <View style={styles.rightCol}>
              <Text style={posType.label}>Customer Info</Text>
              <View style={[posCard(), styles.infoBlock]}>
                <InfoRow label="Name" value={customer} />
                <InfoRow label="Phone" value={phone} />
                <InfoRow label="Address" value={address} />
                <InfoRow label="GST" value={gst} />
                <InfoRow label="Notes" value={notes} />
                <InfoRow label="Type" value={formatOrderTypeLabel(order.orderType)} />
                <InfoRow label="Payment" value={paid ? "Paid" : String(order.paymentStatus ?? "Pending")} />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            {!cancelled ? (
              <>
                <PosButton label="Accept" variant="primary" onPress={onAccept} disabled={busy} style={styles.footerBtn} />
                <PosButton label="Reject" variant="danger" onPress={onReject} disabled={busy} style={styles.footerBtn} />
                <PosButton label="Send Kitchen" variant="secondary" onPress={onSendKitchen} disabled={busy} style={styles.footerBtn} />
                <PosButton label="Ready" variant="secondary" onPress={onReady} disabled={busy} style={styles.footerBtn} />
                <PosButton label="Payment" variant="primary" onPress={onPayment} disabled={busy} style={styles.footerBtn} />
              </>
            ) : null}
            <PosButton label="Print" variant="ghost" onPress={onPrint} disabled={busy} style={styles.footerBtn} />
            <PosButton label="Close" variant="secondary" onPress={onClose} style={styles.footerBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight ? { color: highlight } : null]} numberOfLines={3}>{value}</Text>
    </View>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, bold && styles.totalBold]}>{label}</Text>
      <Text style={[styles.totalValue, bold && styles.totalBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center"
  },
  modal: {
    borderRadius: posRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: posColors.borderStrong
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: posSpacing.xl,
    paddingVertical: posSpacing.lg,
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
  closeText: { fontSize: 16, color: posColors.textSecondary, fontWeight: "700" },
  body: {
    flex: 1,
    flexDirection: "row",
    padding: posSpacing.lg,
    gap: posSpacing.lg,
    minHeight: 0
  },
  leftCol: { width: "22%", minWidth: 180 },
  centerCol: { flex: 1, minWidth: 0 },
  rightCol: { width: "24%", minWidth: 200 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: posColors.card,
    borderWidth: 2,
    borderColor: posColors.border
  },
  timelineDotDone: { backgroundColor: posColors.success, borderColor: posColors.success },
  timelineDotCurrent: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  timelineLabel: { fontSize: 13, color: posColors.textDim, fontWeight: "600" },
  timelineLabelDone: { color: posColors.text },
  infoBlock: { padding: posSpacing.md, marginTop: posSpacing.sm },
  infoRow: { marginBottom: 10 },
  infoLabel: { ...posType.label, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: "600", color: posColors.text },
  itemsBlock: { padding: posSpacing.md, marginTop: posSpacing.sm },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border
  },
  itemName: { fontSize: 14, fontWeight: "700", color: posColors.text },
  itemMeta: { fontSize: 11, color: posColors.textDim, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: "800", color: posColors.primary },
  totals: { paddingTop: posSpacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { fontSize: 13, color: posColors.textSecondary },
  totalValue: { fontSize: 13, fontWeight: "700", color: posColors.text },
  totalBold: { fontSize: 16, fontWeight: "900", color: posColors.primary },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: posSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: posColors.border,
    backgroundColor: posColors.secondary
  },
  footerBtn: { paddingHorizontal: 16, paddingVertical: 10 }
});
