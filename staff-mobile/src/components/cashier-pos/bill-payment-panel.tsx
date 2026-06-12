import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import {
  CASHIER_PAYMENT_METHODS,
  DEFAULT_INVOICE_TAX_PERCENT,
  PAYMENT_METHOD_LABELS,
  computePosBillTotals,
  type PaymentMethodId
} from "../../../services/restaurant-orders";
import { formatOrderTypeLabel, isOrderPaid } from "../../lib/cashier-order-filters";
import { loadHeldOrders, type HeldOrder } from "../../lib/pos/hold-orders-store";
import type { CartLine, DiscountMode, SplitPaymentLine } from "./pos-types";
import { PosCustomerPanel } from "./pos-customer-panel";
import { PosKitchenTracker } from "./pos-kitchen-tracker";
import { PosSplitPayment } from "./pos-split-payment";
import { PosBadge, PosButton, PosChip, PosDivider, PosEmpty, PosInput, PosSectionTitle } from "./pos-ui";
import { posCard, posColors, posPanel, posRadius, posSpacing, posType } from "./pos-theme";

export type BillMode = "existing" | "new";

type Props = {
  mode: BillMode;
  selectedOrder: StaffOrderRow | null;
  cartLines: CartLine[];
  newOrderType: "dine_in" | "parcel" | "online";
  customerName: string;
  phone: string;
  tableLabel: string;
  paymentMethod: PaymentMethodId | null;
  discountPercent: number;
  serviceChargePercent: number;
  busy: boolean;
  orders: StaffOrderRow[];
  customerMode: "walkin" | "existing" | "new";
  discountMode: DiscountMode;
  splitLines: SplitPaymentLine[];
  orderNote: string;
  onCustomerModeChange: (m: "walkin" | "existing" | "new") => void;
  onDiscountModeChange: (m: DiscountMode) => void;
  onSplitChange: (lines: SplitPaymentLine[]) => void;
  onOrderNoteChange: (v: string) => void;
  onHold: () => void;
  onResumeHeld: (held: HeldOrder) => void;
  onCustomerNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onNewOrderTypeChange: (t: "dine_in" | "parcel" | "online") => void;
  onPaymentMethod: (m: PaymentMethodId) => void;
  onDiscountChange: (v: number) => void;
  onServiceChargeChange: (v: number) => void;
  onCartQtyChange: (menuItemId: string, delta: number) => void;
  onRemoveCartLine: (menuItemId: string) => void;
  onSendToKitchen: () => void;
  onAcceptPayment: () => void;
  onPrint: () => void;
  onRefund: () => void;
  tables?: import("../../hooks/use-tables").FloorTable[];
  selectedTableId?: string | null;
  onSelectTable?: (table: import("../../hooks/use-tables").FloorTable) => void;
  tablesLoading?: boolean;
};

const EXTRA_METHODS: PaymentMethodId[] = ["cash", "upi", "card", "wallet", "split"];

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function cartSubtotal(lines: CartLine[]) {
  return Math.round(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0) * 100) / 100;
}

function formatOrderTime(value: unknown) {
  if (!value || typeof value !== "object") return new Date().toLocaleTimeString();
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return new Date().toLocaleTimeString();
  return maybe.toDate().toLocaleString();
}

export function BillPaymentPanel({
  mode,
  selectedOrder,
  cartLines,
  newOrderType,
  customerName,
  phone,
  tableLabel,
  paymentMethod,
  discountPercent,
  serviceChargePercent,
  busy,
  orders,
  customerMode,
  discountMode,
  splitLines,
  orderNote,
  onCustomerModeChange,
  onDiscountModeChange,
  onSplitChange,
  onOrderNoteChange,
  onHold,
  onResumeHeld,
  onCustomerNameChange,
  onPhoneChange,
  onNewOrderTypeChange,
  onPaymentMethod,
  onDiscountChange,
  onServiceChargeChange,
  onCartQtyChange,
  onRemoveCartLine,
  onSendToKitchen,
  onAcceptPayment,
  onPrint,
  onRefund,
  tables = [],
  selectedTableId,
  onSelectTable,
  tablesLoading
}: Props) {
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);

  useEffect(() => {
    setHeldOrders(loadHeldOrders());
  }, [cartLines.length, mode]);

  const subtotal = useMemo(() => {
    if (mode === "new") return cartSubtotal(cartLines);
    return selectedOrder?.totalAmount ?? 0;
  }, [mode, cartLines, selectedOrder]);

  const lines = useMemo(() => {
    if (mode === "new") return cartLines;
    if (!selectedOrder) return [];
    return selectedOrder.items.map((it, i) => ({
      menuItemId: it.id ?? `line_${i}`,
      name: it.name,
      unitPrice: it.price,
      qty: it.qty
    }));
  }, [mode, cartLines, selectedOrder]);

  const totals = useMemo(
    () => computePosBillTotals(subtotal, DEFAULT_INVOICE_TAX_PERCENT, discountPercent, serviceChargePercent),
    [subtotal, discountPercent, serviceChargePercent]
  );

  const roundOff = useMemo(() => {
    const rounded = Math.round(totals.grandTotal);
    return Math.round((rounded - totals.grandTotal) * 100) / 100;
  }, [totals.grandTotal]);

  const displayGrandTotal = totals.grandTotal + roundOff;

  const paid = selectedOrder ? isOrderPaid(selectedOrder.paymentStatus) : false;
  const canPay = mode === "existing" && selectedOrder && !paid;
  const canSend = mode === "new" && cartLines.length > 0;
  const token =
    selectedOrder && typeof selectedOrder.tokenNumber === "number" && selectedOrder.tokenNumber > 0
      ? `#${selectedOrder.tokenNumber}`
      : "—";

  return (
    <View style={[posPanel(), styles.stickyPanel]}>
      <View style={styles.header}>
        <Text style={posType.h3}>Current Bill</Text>
        {mode === "new" ? (
          <View style={styles.typeRow}>
            {(["dine_in", "parcel", "online"] as const).map((t) => {
              const label = t === "dine_in" ? "Dine-In" : t === "parcel" ? "Parcel" : "Online";
              return <PosChip key={t} label={label} active={newOrderType === t} onPress={() => onNewOrderTypeChange(t)} />;
            })}
          </View>
        ) : selectedOrder ? (
          <PosBadge label={formatOrderTypeLabel(selectedOrder.orderType)} color={posColors.primary} />
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator>
        {mode === "existing" && !selectedOrder ? (
          <PosEmpty message="No order selected" hint="Pick an order from the left or press F2 for new" />
        ) : (
          <>
            <PosCustomerPanel
              mode={customerMode}
              phone={phone}
              customerName={customerName}
              orders={orders}
              onModeChange={onCustomerModeChange}
              onPhoneChange={onPhoneChange}
              onNameChange={onCustomerNameChange}
            />

            {mode === "new" && newOrderType === "dine_in" && tables.length > 0 ? (
              <View style={[posCard(), styles.tablePicker]}>
                <PosSectionTitle title="Select Table" />
                {tablesLoading ? <Text style={posType.small}>Loading tables…</Text> : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableRow}>
                  {[...tables]
                    .sort((a, b) => a.number - b.number)
                    .map((t) => {
                      const on = selectedTableId === t.id;
                      const busy = t.status === "occupied";
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => onSelectTable?.(t)}
                          style={[styles.tableChip, on && styles.tableChipOn, busy && !on && styles.tableChipBusy]}
                        >
                          <Text style={[styles.tableChipText, on && styles.tableChipTextOn]}>
                            {t.displayName ?? `T${t.number}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                </ScrollView>
              </View>
            ) : null}

            <PosKitchenTracker order={mode === "existing" ? selectedOrder : null} />

            <View style={[posCard(), styles.detailCard]}>
              <PosSectionTitle title="Order Details" />
              <DetailRow label="Customer" value={customerName || "Walk-in"} />
              <DetailRow label="Table" value={tableLabel || "—"} />
              <DetailRow label="Token" value={token} />
              <DetailRow label="Time" value={selectedOrder ? formatOrderTime(selectedOrder.createdAt) : "Now"} />
              {mode === "new" && (newOrderType === "parcel" || newOrderType === "online") ? (
                <>
                  <PosInput value={customerName} onChangeText={onCustomerNameChange} placeholder="Customer name" style={{ marginTop: posSpacing.sm }} />
                  <PosInput value={phone} onChangeText={onPhoneChange} placeholder="Phone" keyboardType="phone-pad" style={{ marginTop: posSpacing.sm }} />
                </>
              ) : null}
            </View>

            <PosDivider />

            <PosSectionTitle title="Items" />
            {lines.length === 0 ? (
              <Text style={posType.small}>Add products from the menu</Text>
            ) : (
              lines.map((line) => (
                <View key={line.menuItemId} style={styles.lineRow}>
                  <Text style={styles.lineQty}>{line.qty}×</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineName}>{line.name}</Text>
                    <Text style={styles.lineUnit}>{formatMoney(line.unitPrice)} each</Text>
                  </View>
                  {mode === "new" ? (
                    <View style={styles.lineActions}>
                      <PosButton label="−" variant="ghost" onPress={() => onCartQtyChange(line.menuItemId, -1)} style={styles.miniBtn} />
                      <PosButton label="+" variant="ghost" onPress={() => onCartQtyChange(line.menuItemId, 1)} style={styles.miniBtn} />
                      <PosButton label="Del" variant="danger" onPress={() => onRemoveCartLine(line.menuItemId)} style={styles.miniBtn} />
                    </View>
                  ) : null}
                  <Text style={styles.lineTotal}>{formatMoney(line.unitPrice * line.qty)}</Text>
                </View>
              ))
            )}

            <PosDivider />

            <View style={styles.discountModes}>
              {(["percent", "flat", "coupon", "promo"] as DiscountMode[]).map((m) => (
                <PosChip key={m} label={m} active={discountMode === m} onPress={() => onDiscountModeChange(m)} />
              ))}
            </View>

            <View style={[posCard(), styles.summary]}>
              <SummaryRow label="Subtotal" value={formatMoney(totals.subtotal)} />
              <View style={styles.inlineField}>
                <Text style={posType.small}>{discountMode === "flat" ? "Discount ₹" : "Discount %"}</Text>
                <PosInput
                  value={String(discountPercent)}
                  onChangeText={(v) => onDiscountChange(Math.max(0, Math.min(100, Number(v) || 0)))}
                  keyboardType="decimal-pad"
                  style={styles.pctInput}
                />
              </View>
              {totals.discountAmount > 0 ? <SummaryRow label="Discount" value={`−${formatMoney(totals.discountAmount)}`} muted /> : null}
              <View style={styles.inlineField}>
                <Text style={posType.small}>Service %</Text>
                <PosInput
                  value={String(serviceChargePercent)}
                  onChangeText={(v) => onServiceChargeChange(Math.max(0, Math.min(100, Number(v) || 0)))}
                  keyboardType="decimal-pad"
                  style={styles.pctInput}
                />
              </View>
              {totals.serviceChargeAmount > 0 ? <SummaryRow label="Service Charge" value={formatMoney(totals.serviceChargeAmount)} muted /> : null}
              <SummaryRow label={`Tax (${totals.taxPercent}%)`} value={formatMoney(totals.taxAmount)} muted />
              {roundOff !== 0 ? <SummaryRow label="Round Off" value={formatMoney(roundOff)} muted /> : null}
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>Grand Total</Text>
                <Text style={styles.grandValue}>{formatMoney(displayGrandTotal)}</Text>
              </View>
            </View>

            <PosInput value={orderNote} onChangeText={onOrderNoteChange} placeholder="Order notes…" style={{ marginTop: posSpacing.sm }} />

            {paymentMethod === "split" ? <PosSplitPayment grandTotal={displayGrandTotal} lines={splitLines} onChange={onSplitChange} /> : null}

            {(canPay || canSend) && (
              <>
                <PosSectionTitle title="Payment Method" />
                <View style={styles.payGrid}>
                  {EXTRA_METHODS.map((m, i) => {
                    const inCashier = CASHIER_PAYMENT_METHODS.includes(m);
                    if (!inCashier && m !== "split") return null;
                    const on = paymentMethod === m;
                    return (
                      <PressableSegment key={m} label={PAYMENT_METHOD_LABELS[m]} active={on} onPress={() => onPaymentMethod(m)} hint={String(i + 1)} />
                    );
                  })}
                </View>
                {paymentMethod === "split" ? (
                  <Text style={styles.splitHint}>Split: primary method recorded on receipt.</Text>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      {heldOrders.length > 0 ? (
        <View style={styles.heldBlock}>
          <PosSectionTitle title={`Held orders (${heldOrders.length})`} />
          {heldOrders.slice(0, 4).map((h) => (
            <Pressable key={h.id} style={styles.heldRow} onPress={() => onResumeHeld(h)}>
              <View style={{ flex: 1 }}>
                <Text style={posType.body}>{h.label}</Text>
                <Text style={posType.small}>
                  {h.cart.length} items · {h.tableLabel ?? h.orderType}
                </Text>
              </View>
              <Text style={styles.heldResume}>Resume</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {mode === "existing" && selectedOrder ? (
          <>
            <View style={styles.actionRow}>
              <PosButton label="Print" icon="print" variant="secondary" onPress={onPrint} disabled={busy} style={styles.actionHalf} />
              <PosButton label="Kitchen" icon="kitchen" variant="secondary" onPress={onPrint} disabled={busy} style={styles.actionHalf} />
            </View>
            {paid ? (
              <PosButton label="Refund" icon="refund" variant="danger" fullWidth onPress={onRefund} disabled={busy} />
            ) : (
              <PosButton
                label={busy ? "Processing…" : "Accept Payment"}
                icon="pay"
                variant="primary"
                fullWidth
                loading={busy}
                onPress={() => {
                  if (!paymentMethod) {
                    Alert.alert("Payment", "Select a payment method first.");
                    return;
                  }
                  onAcceptPayment();
                }}
              />
            )}
            <View style={styles.actionRow}>
              <PosButton label="Hold" variant="ghost" onPress={onHold} style={styles.actionHalf} />
              <PosButton label="Void" variant="ghost" onPress={() => Alert.alert("Void", "Contact manager to void this order.")} style={styles.actionHalf} />
            </View>
            <PosButton label="Print Options" icon="print" variant="secondary" fullWidth onPress={() => Alert.alert("Print", "Bill · Kitchen · Bar · Customer copy · Reprint · PDF · WhatsApp · Email")} />
          </>
        ) : mode === "new" ? (
          <>
            <PosButton label="Send to Kitchen" icon="kitchen" variant="primary" fullWidth loading={busy} disabled={busy || cartLines.length === 0} onPress={onSendToKitchen} />
            <PosButton label="Hold Order" variant="secondary" fullWidth onPress={onHold} disabled={cartLines.length === 0} />
            <PosButton label="Save Draft" variant="ghost" fullWidth onPress={() => Alert.alert("Draft", "Draft saved locally for this session.")} />
          </>
        ) : null}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={posType.small}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[posType.body, muted && { color: posColors.textSecondary }]}>{label}</Text>
      <Text style={[posType.body, { fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

function PressableSegment({ label, active, onPress, hint }: { label: string; active: boolean; onPress: () => void; hint?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, active && styles.segmentOn]}>
      <Text style={[styles.segmentText, active && styles.segmentTextOn]}>
        {hint ? `${label} · ${hint}` : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stickyPanel: { position: "relative" },
  header: {
    padding: posSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: posSpacing.sm
  },
  typeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  scroll: { padding: posSpacing.lg, paddingBottom: 200, gap: posSpacing.md },
  detailCard: { padding: posSpacing.md, gap: posSpacing.xs },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  detailValue: { fontSize: 13, fontWeight: "700", color: posColors.text },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: posSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    gap: posSpacing.sm
  },
  lineQty: { fontSize: 13, fontWeight: "800", color: posColors.primary, width: 28 },
  lineName: { fontSize: 13, fontWeight: "700", color: posColors.text },
  lineUnit: { fontSize: 11, color: posColors.textDim, marginTop: 2 },
  lineTotal: { fontSize: 13, fontWeight: "800", color: posColors.text, minWidth: 72, textAlign: "right" },
  lineActions: { flexDirection: "row", gap: 4 },
  miniBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  summary: { padding: posSpacing.md, gap: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  inlineField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 4 },
  pctInput: { width: 64, paddingVertical: 8, textAlign: "center" },
  grandRow: {
    marginTop: posSpacing.md,
    paddingTop: posSpacing.md,
    borderTopWidth: 2,
    borderTopColor: posColors.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  grandLabel: { fontSize: 16, fontWeight: "800", color: posColors.text },
  grandValue: { fontSize: 28, fontWeight: "900", color: posColors.success, letterSpacing: -0.5 },
  payGrid: { flexDirection: "row", flexWrap: "wrap", gap: posSpacing.sm },
  segment: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: "30%" as unknown as number,
    flexGrow: 1,
    borderRadius: posRadius.md,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border,
    alignItems: "center"
  },
  segmentOn: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  segmentText: { fontSize: 13, fontWeight: "800", color: posColors.text },
  segmentTextOn: { color: "#fff" },
  segmentHint: { fontSize: 10, fontWeight: "600", color: posColors.textDim },
  splitHint: { fontSize: 11, color: posColors.warning, marginTop: posSpacing.sm },
  discountModes: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: posSpacing.sm },
  actions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: posSpacing.lg,
    gap: posSpacing.sm,
    backgroundColor: posColors.secondary,
    borderTopWidth: 1,
    borderTopColor: posColors.border
  },
  actionRow: { flexDirection: "row", gap: posSpacing.sm },
  actionHalf: { flex: 1 },
  heldBlock: {
    paddingHorizontal: posSpacing.lg,
    paddingBottom: posSpacing.md,
    gap: posSpacing.sm
  },
  heldRow: {
    ...posCard,
    flexDirection: "row",
    alignItems: "center",
    padding: posSpacing.md,
    gap: posSpacing.sm
  },
  heldResume: { fontSize: 12, fontWeight: "800", color: posColors.primary },
  tablePicker: { padding: posSpacing.md, gap: posSpacing.sm },
  tableRow: { gap: posSpacing.sm, paddingVertical: 4 },
  tableChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.bg
  },
  tableChipOn: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  tableChipBusy: { borderColor: posColors.warning, opacity: 0.85 },
  tableChipText: { fontSize: 12, fontWeight: "800", color: posColors.textSecondary },
  tableChipTextOn: { color: "#fff" }
});
