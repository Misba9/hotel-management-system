import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import {
  PAYMENT_METHOD_LABELS,
  computePosBillTotals,
  type PaymentMethodId
} from "../../../services/restaurant-orders";
import type { PosSettingsDoc } from "@shared/types/pos-settings";
import { formatOrderTypeLabel, isOrderPaid } from "../../lib/cashier-order-filters";
import { loadHeldOrders, type HeldOrder } from "../../lib/pos/hold-orders-store";
import type { CartLine, DiscountMode, PosOrderChannel, SplitPaymentLine } from "./pos-types";
import { POS_ITEM_MODIFICATIONS } from "./pos-types";
import { PosCustomerPanel } from "./pos-customer-panel";
import { PosKitchenTracker } from "./pos-kitchen-tracker";
import { PosPaymentFlow } from "./pos-payment-flow";
import { PosSplitPayment } from "./pos-split-payment";
import { PosBadge, PosButton, PosChip, PosDivider, PosEmpty, PosInput, PosSectionTitle } from "./pos-ui";
import { posCard, posColors, posPanel, posRadius, posSpacing, posType } from "./pos-theme";

export type BillMode = "existing" | "new";

type Props = {
  mode: BillMode;
  selectedOrder: StaffOrderRow | null;
  cartLines: CartLine[];
  orderChannel: PosOrderChannel;
  customerName: string;
  phone: string;
  tableLabel: string;
  guestCount: string;
  gstNumber: string;
  address: string;
  paymentMethod: PaymentMethodId | null;
  taxPercent: number;
  posSettings: PosSettingsDoc;
  discountPercent: number;
  discountFlatAmount: number;
  couponCode: string;
  couponError: string | null;
  cashReceived: string;
  serviceChargePercent: number;
  busy: boolean;
  orders: StaffOrderRow[];
  discountMode: DiscountMode;
  splitLines: SplitPaymentLine[];
  onDiscountModeChange: (m: DiscountMode) => void;
  onSplitChange: (lines: SplitPaymentLine[]) => void;
  onCouponCodeChange: (v: string) => void;
  onApplyCoupon: () => void;
  onCashReceivedChange: (v: string) => void;
  onHold: () => void;
  onResumeHeld: (held: HeldOrder) => void;
  onCustomerNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onGuestCountChange: (v: string) => void;
  onGstChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onOrderChannelChange: (t: PosOrderChannel) => void;
  onPaymentMethod: (m: PaymentMethodId) => void;
  onDiscountChange: (v: number) => void;
  onServiceChargeChange: (v: number) => void;
  onCartQtyChange: (menuItemId: string, delta: number) => void;
  onCartLineModify: (menuItemId: string, updates: { modifications?: string[]; note?: string }) => void;
  onRemoveCartLine: (menuItemId: string) => void;
  onPayAndComplete: () => void;
  onPayRazorpay: () => void;
  onAcceptPayment: () => void;
  onPrint: () => void;
  onRefund: () => void;
  onCancelOrder: () => void;
  onSaveDraft: () => void;
  tables?: import("../../hooks/use-tables").FloorTable[];
  selectedTableId?: string | null;
  onSelectTable?: (table: import("../../hooks/use-tables").FloorTable) => void;
  tablesLoading?: boolean;
};

const PAYMENT_OPTIONS: { id: PaymentMethodId; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "wallet", label: "Wallet" },
  { id: "split", label: "Split" }
];

function enabledPaymentOptions(posSettings: PosSettingsDoc) {
  const enabled = new Set(posSettings.enabledPaymentMethods ?? []);
  return PAYMENT_OPTIONS.filter((o) => enabled.has(o.id as (typeof posSettings.enabledPaymentMethods)[number]));
}

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function formatLineExtras(line: Pick<CartLine, "modifications" | "note">) {
  const parts = [...(line.modifications ?? [])];
  if (line.note?.trim()) parts.push(line.note.trim());
  return parts.join(" · ");
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
  orderChannel,
  customerName,
  phone,
  tableLabel,
  guestCount,
  gstNumber,
  address,
  paymentMethod,
  taxPercent,
  posSettings,
  discountPercent,
  discountFlatAmount,
  couponCode,
  couponError,
  cashReceived,
  serviceChargePercent,
  busy,
  orders,
  discountMode,
  splitLines,
  onDiscountModeChange,
  onSplitChange,
  onCouponCodeChange,
  onApplyCoupon,
  onCashReceivedChange,
  onHold,
  onResumeHeld,
  onCustomerNameChange,
  onPhoneChange,
  onGuestCountChange,
  onGstChange,
  onAddressChange,
  onOrderChannelChange,
  onPaymentMethod,
  onDiscountChange,
  onServiceChargeChange,
  onCartQtyChange,
  onCartLineModify,
  onRemoveCartLine,
  onPayAndComplete,
  onPayRazorpay,
  onAcceptPayment,
  onPrint,
  onRefund,
  onCancelOrder,
  onSaveDraft,
  tables = [],
  selectedTableId,
  onSelectTable,
  tablesLoading
}: Props) {
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [modifyLineId, setModifyLineId] = useState<string | null>(null);
  const [draftMods, setDraftMods] = useState<string[]>([]);
  const [draftNote, setDraftNote] = useState("");

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
    const rawItems = selectedOrder.items as Array<{
      id?: string;
      name: string;
      price: number;
      qty: number;
      note?: string;
      modifications?: string[];
    }>;
    return rawItems.map((it, i) => ({
      menuItemId: it.id ?? `line_${i}`,
      name: it.name,
      unitPrice: it.price,
      qty: it.qty,
      note: it.note,
      modifications: it.modifications
    }));
  }, [mode, cartLines, selectedOrder]);

  const modifyLine = useMemo(
    () => (modifyLineId ? lines.find((l) => l.menuItemId === modifyLineId) ?? null : null),
    [modifyLineId, lines]
  );

  const openModifyModal = (line: CartLine) => {
    setModifyLineId(line.menuItemId);
    setDraftMods(line.modifications ?? []);
    setDraftNote(line.note ?? "");
  };

  const closeModifyModal = () => {
    setModifyLineId(null);
    setDraftMods([]);
    setDraftNote("");
  };

  const saveModifyModal = () => {
    if (!modifyLineId) return;
    onCartLineModify(modifyLineId, {
      modifications: draftMods.length > 0 ? draftMods : undefined,
      note: draftNote.trim() || undefined
    });
    closeModifyModal();
  };

  const toggleDraftMod = (mod: string) => {
    setDraftMods((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  };

  const flatDiscount = discountMode === "coupon" || discountMode === "flat" ? discountFlatAmount : 0;
  const pctDiscount = discountMode === "percent" || discountMode === "promo" ? discountPercent : 0;

  const totals = useMemo(
    () => computePosBillTotals(subtotal, taxPercent, pctDiscount, serviceChargePercent, flatDiscount),
    [subtotal, taxPercent, pctDiscount, serviceChargePercent, flatDiscount]
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
    <>
    <View style={[posPanel(), styles.stickyPanel]}>
      <View style={styles.header}>
        <Text style={posType.h2}>Current Bill</Text>
        {mode === "existing" && selectedOrder ? (
          <PosBadge label={formatOrderTypeLabel(selectedOrder.orderType)} color={posColors.primary} />
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator>
        {mode === "existing" && !selectedOrder ? (
          <PosEmpty message="No order selected" hint="Open from Recent Orders or press F2 for new" />
        ) : (
          <>
            <PosCustomerPanel
              phone={phone}
              customerName={customerName}
              guestCount={guestCount}
              gstNumber={gstNumber}
              address={address}
              tableLabel={tableLabel}
              orders={orders}
              onPhoneChange={onPhoneChange}
              onNameChange={onCustomerNameChange}
              onGuestCountChange={onGuestCountChange}
              onGstChange={onGstChange}
              onAddressChange={onAddressChange}
            />

            {mode === "new" ? (
              <View style={styles.channelSection}>
                <PosSectionTitle title="Order Type" />
                <View style={styles.channelGrid}>
                  <View style={[styles.channelBtn, { backgroundColor: posColors.parcel, borderColor: posColors.parcel }]}>
                    <Text style={styles.channelEmoji}>🛍</Text>
                    <Text style={[styles.channelLabel, styles.channelLabelOn]}>Parcel</Text>
                  </View>
                </View>
                <Text style={posType.small}>Cashier can only create new Parcel orders. Other channels sync automatically.</Text>
              </View>
            ) : null}

            {false && mode === "new" && orderChannel === "dine_in" && tables.length > 0 ? (
              <View style={[posCard(), styles.tablePicker]}>
                <PosSectionTitle title="Select Table" />
                {tablesLoading ? <Text style={posType.small}>Loading tables…</Text> : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableRow}>
                  {[...tables]
                    .sort((a, b) => a.number - b.number)
                    .map((t) => {
                      const on = selectedTableId === t.id;
                      const occupied = t.status === "occupied";
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => onSelectTable?.(t)}
                          style={[styles.tableChip, on && styles.tableChipOn, occupied && !on && styles.tableChipBusy]}
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

            <PosSectionTitle title="Items" />
            {lines.length === 0 ? (
              <Text style={posType.small}>Add products from the menu</Text>
            ) : (
              lines.map((line) => {
                const extras = formatLineExtras(line);
                return (
                <View key={line.menuItemId} style={styles.lineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineName}>{line.name}</Text>
                    <Text style={styles.lineUnit}>
                      {formatMoney(line.unitPrice)} · x{line.qty}
                    </Text>
                    {extras ? <Text style={styles.lineExtras}>{extras}</Text> : null}
                  </View>
                  {mode === "new" ? (
                    <View style={styles.lineActions}>
                      <Pressable onPress={() => onCartQtyChange(line.menuItemId, -1)} style={styles.lineBtn}>
                        <Text style={styles.lineBtnText}>−</Text>
                      </Pressable>
                      <Pressable onPress={() => onCartQtyChange(line.menuItemId, 1)} style={styles.lineBtn}>
                        <Text style={styles.lineBtnText}>+</Text>
                      </Pressable>
                      <Pressable onPress={() => openModifyModal(line)} style={[styles.lineBtn, extras ? styles.lineBtnActive : null]}>
                        <Text style={styles.lineBtnText}>◇</Text>
                      </Pressable>
                      <Pressable onPress={() => onRemoveCartLine(line.menuItemId)} style={[styles.lineBtn, styles.lineBtnDel]}>
                        <Text style={styles.lineBtnTextDel}>✕</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <Text style={styles.lineTotal}>{formatMoney(line.unitPrice * line.qty)}</Text>
                </View>
              );
              })
            )}

            <PosDivider />

            <View style={styles.discountModes}>
              {(["percent", "flat", "coupon"] as DiscountMode[]).map((m) => (
                <PosChip key={m} label={m} active={discountMode === m} onPress={() => onDiscountModeChange(m)} />
              ))}
            </View>

            <View style={[posCard(), styles.summary]}>
              <SummaryRow label="Subtotal" value={formatMoney(totals.subtotal)} />
              {totals.discountAmount > 0 ? (
                <SummaryRow
                  label={discountMode === "coupon" && couponCode ? `Coupon (${couponCode})` : "Discount"}
                  value={`−${formatMoney(totals.discountAmount)}`}
                  muted
                />
              ) : null}
              <SummaryRow label={`Tax (${totals.taxPercent}%)`} value={formatMoney(totals.taxAmount)} muted />
              {totals.serviceChargeAmount > 0 ? (
                <SummaryRow label="Service Charge" value={formatMoney(totals.serviceChargeAmount)} muted />
              ) : null}
              <SummaryRow label="Round Off" value={formatMoney(roundOff)} muted />
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>Grand Total</Text>
                <Text style={styles.grandValue}>{formatMoney(displayGrandTotal)}</Text>
              </View>
            </View>

            {discountMode === "coupon" ? (
              <View style={styles.couponRow}>
                <PosInput
                  value={couponCode}
                  onChangeText={onCouponCodeChange}
                  placeholder="Coupon code"
                  autoCapitalize="characters"
                  style={styles.couponInput}
                />
                <Pressable onPress={onApplyCoupon} style={styles.couponBtn}>
                  <Text style={styles.couponBtnText}>Apply</Text>
                </Pressable>
              </View>
            ) : null}
            {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}

            {discountMode === "percent" || discountMode === "promo" ? (
              <View style={styles.inlineField}>
                <Text style={posType.small}>Discount %</Text>
                <PosInput
                  value={String(discountPercent)}
                  onChangeText={(v) => onDiscountChange(Math.max(0, Math.min(100, Number(v) || 0)))}
                  keyboardType="decimal-pad"
                  style={styles.pctInput}
                />
              </View>
            ) : null}

            {discountMode === "flat" ? (
              <View style={styles.inlineField}>
                <Text style={posType.small}>Discount ₹</Text>
                <PosInput
                  value={String(discountFlatAmount)}
                  onChangeText={(v) => onDiscountChange(Math.max(0, Number(v) || 0))}
                  keyboardType="decimal-pad"
                  style={styles.pctInput}
                />
              </View>
            ) : null}

            {(canPay || canSend) && (
              <>
                <PosSectionTitle title="Payment" />
                <View style={styles.payGrid}>
                  {enabledPaymentOptions(posSettings).map((m) => {
                    const on = paymentMethod === m.id;
                    return (
                      <Pressable key={m.id} onPress={() => onPaymentMethod(m.id)} style={[styles.payBtn, on && styles.payBtnOn]}>
                        <Text style={[styles.payBtnText, on && styles.payBtnTextOn]}>{m.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {paymentMethod === "split" ? (
                  <PosSplitPayment grandTotal={displayGrandTotal} lines={splitLines} onChange={onSplitChange} />
                ) : null}
                {paymentMethod && paymentMethod !== "split" ? (
                  <PosPaymentFlow
                    method={paymentMethod}
                    grandTotal={displayGrandTotal}
                    posSettings={posSettings}
                    cashReceived={cashReceived}
                    onCashReceivedChange={onCashReceivedChange}
                    onConfirmManual={mode === "new" ? onPayAndComplete : onAcceptPayment}
                    onConfirmRazorpay={onPayRazorpay}
                    busy={busy}
                  />
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      {heldOrders.length > 0 ? (
        <View style={styles.heldBlock}>
          <PosSectionTitle title={`Held orders (${heldOrders.length})`} />
          {heldOrders.slice(0, 3).map((h) => (
            <Pressable key={h.id} style={styles.heldRow} onPress={() => onResumeHeld(h)}>
              <View style={{ flex: 1 }}>
                <Text style={posType.body}>{h.label}</Text>
                <Text style={posType.small}>{h.cart.length} items · {h.tableLabel ?? h.orderType}</Text>
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
              <ActionBtn label="Print Bill" emoji="🟣" color={posColors.purple} onPress={onPrint} disabled={busy} flex />
              <ActionBtn label="Kitchen" emoji="🔵" color={posColors.info} onPress={onPrint} disabled={busy} flex />
            </View>
            {paid ? (
              <ActionBtn label="Refund" emoji="🔴" color={posColors.danger} onPress={onRefund} disabled={busy} full />
            ) : (
              <ActionBtn
                label={busy ? "Processing…" : "Complete Payment"}
                emoji="🟢"
                color={posColors.success}
                onPress={() => {
                  if (!paymentMethod) {
                    Alert.alert("Payment", "Select a payment method first.");
                    return;
                  }
                  onAcceptPayment();
                }}
                disabled={busy}
                full
              />
            )}
            <View style={styles.actionRow}>
              <ActionBtn label="Hold Order" emoji="🟡" color={posColors.warning} onPress={onHold} flex />
              <ActionBtn label="Cancel Order" emoji="🔴" color={posColors.danger} onPress={onCancelOrder} flex />
            </View>
          </>
        ) : mode === "new" ? (
          <>
            <ActionBtn
              label={paymentMethod ? (busy ? "Processing…" : "Pay & send to kitchen") : "Select payment method"}
              emoji="🟢"
              color={posColors.success}
              onPress={() => {
                if (!paymentMethod) {
                  Alert.alert("Payment", "Select a payment method first.");
                  return;
                }
                if (paymentMethod === "split") {
                  onPayAndComplete();
                  return;
                }
                Alert.alert("Payment", "Use the payment panel above to confirm and print.");
              }}
              disabled={busy || cartLines.length === 0 || !paymentMethod}
              full
            />
            <View style={styles.actionRow}>
              <ActionBtn label="Save Draft" emoji="🔵" color={posColors.info} onPress={onSaveDraft} flex />
              <ActionBtn label="Hold Order" emoji="🟡" color={posColors.warning} onPress={onHold} flex />
            </View>
            <ActionBtn label="Cancel Order" emoji="🔴" color={posColors.danger} onPress={onCancelOrder} full />
          </>
        ) : null}
      </View>
    </View>

      <Modal visible={modifyLineId != null} transparent animationType="fade" onRequestClose={closeModifyModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModifyModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Item modifications</Text>
            {modifyLine ? <Text style={styles.modalSubtitle}>{modifyLine.name}</Text> : null}
            <View style={styles.modGrid}>
              {POS_ITEM_MODIFICATIONS.map((mod) => {
                const on = draftMods.includes(mod);
                return (
                  <Pressable
                    key={mod}
                    onPress={() => toggleDraftMod(mod)}
                    style={[styles.modChip, on && styles.modChipOn]}
                  >
                    <Text style={[styles.modChipText, on && styles.modChipTextOn]}>{mod}</Text>
                  </Pressable>
                );
              })}
            </View>
            <PosInput
              value={draftNote}
              onChangeText={setDraftNote}
              placeholder="Other instructions (e.g. less sweet)"
              style={styles.modalNote}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeModifyModal} style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveModifyModal} style={[styles.modalBtn, styles.modalBtnPrimary]}>
                <Text style={styles.modalBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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

function ActionBtn({
  label,
  emoji,
  color,
  onPress,
  disabled,
  full,
  flex
}: {
  label: string;
  emoji: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  full?: boolean;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionBtn,
        { backgroundColor: color, opacity: disabled ? 0.45 : 1 },
        full && { width: "100%" },
        flex && { flex: 1 }
      ]}
    >
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stickyPanel: { position: "relative" },
  header: {
    padding: posSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  scroll: { padding: posSpacing.md, paddingBottom: 220, gap: posSpacing.md },
  channelSection: { gap: posSpacing.sm },
  channelGrid: { flexDirection: "row", flexWrap: "wrap", gap: posSpacing.xs },
  channelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: posRadius.md,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border,
    minWidth: "30%" as unknown as number,
    flexGrow: 1
  },
  channelEmoji: { fontSize: 14 },
  channelLabel: { fontSize: 11, fontWeight: "800", color: posColors.textSecondary },
  channelLabelOn: { color: "#fff" },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: posSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    gap: posSpacing.sm
  },
  lineName: { fontSize: 13, fontWeight: "700", color: posColors.text },
  lineUnit: { fontSize: 11, color: posColors.textDim, marginTop: 2 },
  lineExtras: { fontSize: 10, color: posColors.primary, marginTop: 3, fontWeight: "600" },
  lineTotal: { fontSize: 14, fontWeight: "800", color: posColors.text, minWidth: 72, textAlign: "right" },
  lineActions: { flexDirection: "row", gap: 2 },
  lineBtn: {
    width: 28,
    height: 28,
    borderRadius: posRadius.sm,
    backgroundColor: posColors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: posColors.border
  },
  lineBtnActive: { borderColor: posColors.primary, backgroundColor: posColors.primaryMuted },
  lineBtnDel: { backgroundColor: posColors.dangerMuted, borderColor: posColors.dangerMuted },
  lineBtnText: { fontSize: 14, fontWeight: "800", color: posColors.text },
  lineBtnTextDel: { fontSize: 12, fontWeight: "800", color: posColors.danger },
  summary: { padding: posSpacing.md, gap: 6 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  inlineField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pctInput: { width: 64, paddingVertical: 8, textAlign: "center" },
  couponRow: { flexDirection: "row", gap: posSpacing.xs, alignItems: "center" },
  couponInput: { flex: 1 },
  couponBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: posRadius.md,
    backgroundColor: posColors.primary
  },
  couponBtnText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  couponError: { fontSize: 11, color: posColors.danger, fontWeight: "600" },
  grandRow: {
    marginTop: posSpacing.sm,
    paddingTop: posSpacing.sm,
    borderTopWidth: 2,
    borderTopColor: posColors.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  grandLabel: { fontSize: 15, fontWeight: "800", color: posColors.text },
  grandValue: { fontSize: 26, fontWeight: "900", color: posColors.success, letterSpacing: -0.5 },
  payGrid: { flexDirection: "row", flexWrap: "wrap", gap: posSpacing.xs },
  payBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: "30%" as unknown as number,
    flexGrow: 1,
    borderRadius: posRadius.md,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border,
    alignItems: "center"
  },
  payBtnOn: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  payBtnText: { fontSize: 12, fontWeight: "800", color: posColors.text },
  payBtnTextOn: { color: "#fff" },
  discountModes: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: posSpacing.md,
    gap: posSpacing.xs,
    backgroundColor: posColors.secondary,
    borderTopWidth: 1,
    borderTopColor: posColors.border
  },
  actionRow: { flexDirection: "row", gap: posSpacing.xs },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: posRadius.md
  },
  actionEmoji: { fontSize: 12 },
  actionLabel: { fontSize: 13, fontWeight: "800", color: "#fff" },
  heldBlock: { paddingHorizontal: posSpacing.md, paddingBottom: posSpacing.sm, gap: posSpacing.xs },
  heldRow: { ...posCard(), flexDirection: "row", alignItems: "center", padding: posSpacing.sm, gap: posSpacing.sm },
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
  tableChipTextOn: { color: "#fff" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: posSpacing.lg
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    ...posCard(),
    padding: posSpacing.lg,
    gap: posSpacing.sm
  },
  modalTitle: { ...posType.h2, fontSize: 16 },
  modalSubtitle: { ...posType.small, marginBottom: posSpacing.xs },
  modGrid: { flexDirection: "row", flexWrap: "wrap", gap: posSpacing.xs },
  modChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: posRadius.pill,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.bg
  },
  modChipOn: { backgroundColor: posColors.primaryMuted, borderColor: posColors.primary },
  modChipText: { fontSize: 11, fontWeight: "700", color: posColors.textSecondary },
  modChipTextOn: { color: posColors.primary },
  modalNote: { marginTop: posSpacing.xs },
  modalActions: { flexDirection: "row", gap: posSpacing.sm, marginTop: posSpacing.sm },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: posRadius.md,
    alignItems: "center"
  },
  modalBtnGhost: { backgroundColor: posColors.card, borderWidth: 1, borderColor: posColors.border },
  modalBtnPrimary: { backgroundColor: posColors.primary },
  modalBtnGhostText: { fontSize: 13, fontWeight: "800", color: posColors.textSecondary },
  modalBtnPrimaryText: { fontSize: 13, fontWeight: "800", color: "#fff" }
});
