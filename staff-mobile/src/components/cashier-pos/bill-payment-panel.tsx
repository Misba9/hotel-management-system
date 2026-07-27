import React, { memo, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import { computePosBillTotals, type PaymentMethodId } from "../../../services/restaurant-orders";
import type { PosSettingsDoc } from "@shared/types/pos-settings";
import { formatOrderTypeLabel, isOrderPaid } from "../../lib/cashier-order-filters";
import { loadHeldOrders, type HeldOrder } from "../../lib/pos/hold-orders-store";
import type { CartLine, DiscountMode, PosOrderChannel, SplitPaymentLine } from "./pos-types";
import { POS_BILL_ORDER_CHIPS } from "./pos-types";
import { formatLineExtras, ItemModificationsModal } from "../../../components/ItemModificationsModal";
import { PosSplitPayment } from "./pos-split-payment";
import { PosBadge, PosEmpty, PosInput } from "./pos-ui";
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
  { id: "split", label: "Split" }
];

function enabledPaymentOptions(posSettings: PosSettingsDoc) {
  const enabled = new Set(posSettings.enabledPaymentMethods ?? []);
  const opts = PAYMENT_OPTIONS.filter((o) => enabled.has(o.id as (typeof posSettings.enabledPaymentMethods)[number]));
  return opts.length > 0 ? opts : PAYMENT_OPTIONS;
}

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function cartSubtotal(lines: CartLine[]) {
  return Math.round(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0) * 100) / 100;
}

export const BillPaymentPanel = memo(function BillPaymentPanel({
  mode,
  selectedOrder,
  cartLines,
  orderChannel,
  customerName,
  phone,
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
  onOrderChannelChange,
  onPaymentMethod,
  onDiscountChange,
  onCartQtyChange,
  onCartLineModify,
  onRemoveCartLine,
  onPayAndComplete,
  onPayRazorpay,
  onAcceptPayment,
  onPrint,
  onRefund,
  onCancelOrder,
  onSaveDraft
}: Props) {
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [modifyLineId, setModifyLineId] = useState<string | null>(null);
  const [draftDiscountMode, setDraftDiscountMode] = useState<DiscountMode>(discountMode);
  const [draftDiscountValue, setDraftDiscountValue] = useState("");

  useEffect(() => {
    if (paymentMethod !== "cash") setCashOpen(false);
  }, [paymentMethod]);

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
  const cashChange = Math.max(0, Math.round(((Number(cashReceived) || 0) - displayGrandTotal) * 100) / 100);

  const paid = selectedOrder ? isOrderPaid(selectedOrder.paymentStatus) : false;
  const canEditCart = mode === "new";
  const hasItems = lines.length > 0;
  const canPayNew = mode === "new" && hasItems && paymentMethod != null;
  const canPayExisting = mode === "existing" && selectedOrder != null && !paid && paymentMethod != null;

  const token =
    selectedOrder && typeof selectedOrder.tokenNumber === "number" && selectedOrder.tokenNumber > 0
      ? `#${selectedOrder.tokenNumber}`
      : "New";

  const customerLabel =
    customerName.trim() || phone.trim() ? customerName.trim() || phone.trim() : "Walk-in Customer";

  const useRazorpay =
    posSettings.paymentProvider === "razorpay" && (paymentMethod === "upi" || paymentMethod === "card");

  const payLabel = busy ? "Processing…" : paid ? "Paid" : "Confirm";

  const handlePay = () => {
    if (!paymentMethod) {
      Alert.alert("Payment", "Select Cash, UPI, Card, or Split.");
      return;
    }
    if (mode === "new") {
      if (!hasItems) {
        Alert.alert("Cart empty", "Tap products to add items.");
        return;
      }
      if (useRazorpay) {
        onPayRazorpay();
        return;
      }
      onPayAndComplete();
      return;
    }
    if (mode === "existing" && selectedOrder && !paid) {
      if (useRazorpay) {
        onPayRazorpay();
        return;
      }
      onAcceptPayment();
    }
  };

  const openDiscount = () => {
    setDraftDiscountMode(discountMode === "promo" ? "percent" : discountMode === "coupon" ? "coupon" : discountMode);
    setDraftDiscountValue(
      discountMode === "flat"
        ? String(discountFlatAmount || "")
        : discountMode === "coupon"
          ? couponCode
          : String(discountPercent || "")
    );
    setDiscountOpen(true);
  };

  const applyDiscountPopup = () => {
    onDiscountModeChange(draftDiscountMode);
    if (draftDiscountMode === "coupon") {
      onCouponCodeChange(draftDiscountValue.trim().toUpperCase());
      onApplyCoupon();
    } else if (draftDiscountMode === "flat") {
      onDiscountChange(Math.max(0, Number(draftDiscountValue) || 0));
    } else {
      onDiscountChange(Math.max(0, Math.min(100, Number(draftDiscountValue) || 0)));
    }
    setDiscountOpen(false);
  };

  const clearDiscount = () => {
    onDiscountModeChange("percent");
    onDiscountChange(0);
    onCouponCodeChange("");
    setDiscountOpen(false);
  };

  return (
    <>
      <View style={[posPanel(), styles.panel]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Current Bill</Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {token}
              {" · "}
              {customerLabel}
            </Text>
          </View>
          {mode === "existing" && selectedOrder ? (
            <PosBadge label={formatOrderTypeLabel(selectedOrder.orderType)} color={posColors.primary} />
          ) : null}
        </View>

        {mode === "existing" && !selectedOrder ? (
          <View style={styles.emptyWrap}>
            <PosEmpty message="No order selected" hint="Tap products or open Recent Orders" />
          </View>
        ) : (
          <>
            <View style={styles.topMeta}>
              <Pressable
                onPress={() => setCustomerOpen((v) => !v)}
                style={styles.customerChip}
                accessibilityLabel="Customer"
              >
                <Text style={styles.customerChipText} numberOfLines={1}>
                  {customerLabel}
                </Text>
                <Text style={styles.customerChevron}>{customerOpen ? "▲" : "▼"}</Text>
              </Pressable>

              {canEditCart ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.typeRow}
                >
                  {POS_BILL_ORDER_CHIPS.map((chip) => {
                    const on = orderChannel === chip.id;
                    return (
                      <Pressable
                        key={chip.id}
                        onPress={() => onOrderChannelChange(chip.id)}
                        style={[styles.typeChip, on && { borderColor: chip.color, backgroundColor: `${chip.color}22` }]}
                      >
                        <Text style={styles.typeEmoji}>{chip.emoji}</Text>
                        <Text style={[styles.typeLabel, on && { color: chip.color }]}>{chip.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>

            {customerOpen ? (
              <View style={styles.customerForm}>
                <PosInput
                  value={phone}
                  onChangeText={onPhoneChange}
                  placeholder="Phone (optional)"
                  keyboardType="phone-pad"
                  style={styles.customerInput}
                />
                <PosInput
                  value={customerName}
                  onChangeText={onCustomerNameChange}
                  placeholder="Name (optional)"
                  style={styles.customerInput}
                />
              </View>
            ) : null}

            <ScrollView
              style={styles.scrollFlex}
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {lines.length === 0 ? (
                <Text style={styles.hint}>Tap products to add · No confirmation needed</Text>
              ) : (
                lines.map((line) => {
                  const extras = formatLineExtras(line);
                  return (
                    <Pressable
                      key={line.menuItemId}
                      onPress={() => {
                        if (canEditCart) setModifyLineId(line.menuItemId);
                      }}
                      onLongPress={() => {
                        if (!canEditCart) return;
                        Alert.alert(line.name, undefined, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Duplicate",
                            onPress: () => onCartQtyChange(line.menuItemId, 1)
                          },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => onRemoveCartLine(line.menuItemId)
                          }
                        ]);
                      }}
                      style={({ pressed }) => [styles.lineRow, pressed && canEditCart && styles.lineRowPressed]}
                    >
                      <View style={styles.lineInfo}>
                        <Text style={styles.lineName} numberOfLines={2}>
                          {line.name}
                        </Text>
                        <Text style={styles.lineUnit}>
                          {formatMoney(line.unitPrice)}
                          {extras ? ` · ${extras}` : ""}
                        </Text>
                      </View>
                      <Text style={styles.qtyReadonly}>×{line.qty}</Text>
                      <Text style={styles.lineTotal}>{formatMoney(line.unitPrice * line.qty)}</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.totals}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{formatMoney(totals.subtotal)}</Text>
                </View>
                {totals.discountAmount > 0 ? (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabelMuted}>Discount</Text>
                    <Text style={styles.totalValueMuted}>−{formatMoney(totals.discountAmount)}</Text>
                  </View>
                ) : null}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabelMuted}>Tax ({totals.taxPercent}%)</Text>
                  <Text style={styles.totalValueMuted}>{formatMoney(totals.taxAmount)}</Text>
                </View>
                <View style={styles.grandRow}>
                  <View style={styles.grandLeft}>
                    <Text style={styles.grandLabel}>Grand Total</Text>
                    <Pressable onPress={openDiscount} style={styles.discountIcon} hitSlop={10} accessibilityLabel="Add discount">
                      <Text style={styles.discountIconText}>%</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.grandValue}>{formatMoney(displayGrandTotal)}</Text>
                </View>
              </View>

              {(canPayNew || canPayExisting || (mode === "existing" && selectedOrder && !paid) || canEditCart) &&
              !paid ? (
                <View style={styles.payMethods}>
                  {enabledPaymentOptions(posSettings).map((m) => {
                    const on = paymentMethod === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => onPaymentMethod(m.id)}
                        style={[styles.payMethod, on && styles.payMethodOn]}
                      >
                        <Text style={[styles.payMethodText, on && styles.payMethodTextOn]}>{m.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {paymentMethod === "cash" && !paid ? (
                <View style={styles.cashOptional}>
                  <Pressable
                    onPress={() => setCashOpen((v) => !v)}
                    style={styles.cashToggle}
                    accessibilityLabel="Cash received optional"
                  >
                    <Text style={styles.cashToggleText}>
                      {cashOpen ? "▼" : "▶"} Cash Received (Optional)
                    </Text>
                    {!cashOpen && Number(cashReceived) > 0 ? (
                      <Text style={styles.cashToggleHint}>Change {formatMoney(cashChange)}</Text>
                    ) : null}
                  </Pressable>
                  {cashOpen ? (
                    <View style={styles.cashRow}>
                      <PosInput
                        value={cashReceived}
                        onChangeText={onCashReceivedChange}
                        placeholder="Cash received"
                        keyboardType="decimal-pad"
                        style={styles.cashInput}
                      />
                      <View style={styles.changeBox}>
                        <Text style={styles.changeLabel}>Change</Text>
                        <Text style={styles.changeValue}>{formatMoney(cashChange)}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {paymentMethod === "split" && !paid ? (
                <PosSplitPayment grandTotal={displayGrandTotal} lines={splitLines} onChange={onSplitChange} />
              ) : null}

              {mode === "existing" && selectedOrder && paid ? (
                <View style={styles.actionStack}>
                  <Pressable style={[styles.primaryBtn, { backgroundColor: posColors.purple }]} onPress={onPrint} disabled={busy}>
                    <Text style={styles.primaryBtnText}>Print Bill</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryBtn, { borderColor: posColors.danger }]} onPress={onRefund} disabled={busy}>
                    <Text style={[styles.secondaryBtnText, { color: posColors.danger }]}>Refund</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actionStack}>
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      (!canPayNew && !canPayExisting) || busy ? styles.primaryBtnDisabled : null
                    ]}
                    onPress={handlePay}
                    disabled={busy || (!canPayNew && !canPayExisting)}
                  >
                    <Text style={styles.primaryBtnText}>{payLabel}</Text>
                  </Pressable>
                  <View style={styles.secondaryRow}>
                    <Pressable style={[styles.secondaryBtn, styles.holdBtn]} onPress={onHold} disabled={busy}>
                      <Text style={[styles.secondaryBtnText, { color: posColors.warning }]}>Hold</Text>
                    </Pressable>
                    {canEditCart ? (
                      <Pressable style={[styles.secondaryBtn, styles.draftBtn]} onPress={onSaveDraft} disabled={busy}>
                        <Text style={[styles.secondaryBtnText, { color: posColors.info }]}>Draft</Text>
                      </Pressable>
                    ) : (
                      <Pressable style={[styles.secondaryBtn, styles.draftBtn]} onPress={onPrint} disabled={busy}>
                        <Text style={[styles.secondaryBtnText, { color: posColors.info }]}>Print</Text>
                      </Pressable>
                    )}
                    <Pressable style={[styles.secondaryBtn, styles.cancelBtn]} onPress={onCancelOrder} disabled={busy}>
                      <Text style={[styles.secondaryBtnText, { color: posColors.danger }]}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {heldOrders.length > 0 ? (
                <View style={styles.heldBlock}>
                  {heldOrders.slice(0, 2).map((h) => (
                    <Pressable key={h.id} style={styles.heldRow} onPress={() => onResumeHeld(h)}>
                      <Text style={styles.heldLabel} numberOfLines={1}>
                        {h.label} · {h.cart.length} items
                      </Text>
                      <Text style={styles.heldResume}>Resume</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>

      <Modal visible={discountOpen} transparent animationType="fade" onRequestClose={() => setDiscountOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDiscountOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Discount</Text>
            <View style={styles.discountModes}>
              {(
                [
                  { id: "percent" as const, label: "%" },
                  { id: "flat" as const, label: "₹" },
                  { id: "coupon" as const, label: "Coupon" }
                ] as const
              ).map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setDraftDiscountMode(m.id)}
                  style={[styles.discountModeChip, draftDiscountMode === m.id && styles.discountModeChipOn]}
                >
                  <Text style={[styles.discountModeText, draftDiscountMode === m.id && styles.discountModeTextOn]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PosInput
              value={draftDiscountValue}
              onChangeText={setDraftDiscountValue}
              placeholder={
                draftDiscountMode === "coupon" ? "Code" : draftDiscountMode === "flat" ? "Amount ₹" : "Percent"
              }
              autoCapitalize={draftDiscountMode === "coupon" ? "characters" : "none"}
              keyboardType={draftDiscountMode === "coupon" ? "default" : "decimal-pad"}
            />
            {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={clearDiscount} style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnGhostText}>Clear</Text>
              </Pressable>
              <Pressable onPress={applyDiscountPopup} style={[styles.modalBtn, styles.modalBtnPrimary]}>
                <Text style={styles.modalBtnPrimaryText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ItemModificationsModal
        visible={modifyLine != null && canEditCart}
        productName={modifyLine?.name ?? ""}
        initialModifications={modifyLine?.modifications ?? []}
        initialNote={modifyLine?.note ?? ""}
        quantity={modifyLine?.qty}
        unitPrice={modifyLine?.unitPrice}
        onQuantityChange={(qty) => {
          if (!modifyLine) return;
          const delta = qty - modifyLine.qty;
          if (delta !== 0) onCartQtyChange(modifyLine.menuItemId, delta);
        }}
        onRemove={() => {
          if (!modifyLine) return;
          onRemoveCartLine(modifyLine.menuItemId);
          setModifyLineId(null);
        }}
        onClose={() => setModifyLineId(null)}
        onSave={(mods, note) => {
          if (!modifyLine) return;
          onCartLineModify(modifyLine.menuItemId, {
            modifications: mods.length > 0 ? mods : undefined,
            note: note || undefined
          });
          setModifyLineId(null);
        }}
      />
    </>
  );
});

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    minHeight: 0,
    backgroundColor: posColors.secondary
  },
  header: {
    paddingHorizontal: posSpacing.md,
    paddingVertical: posSpacing.sm,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: posSpacing.sm,
    flexShrink: 0
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: posColors.text, letterSpacing: -0.3 },
  headerMeta: { fontSize: 12, fontWeight: "600", color: posColors.textSecondary },
  emptyWrap: { flex: 1, justifyContent: "center" },
  topMeta: { flexShrink: 0, gap: 8, paddingHorizontal: posSpacing.md, paddingTop: posSpacing.sm },
  customerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: posRadius.md,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  customerChipText: { flex: 1, fontSize: 13, fontWeight: "700", color: posColors.text },
  customerChevron: { fontSize: 10, color: posColors.textDim },
  customerForm: { paddingHorizontal: posSpacing.md, gap: 6, paddingTop: 6 },
  customerInput: { paddingVertical: 8 },
  typeRow: { gap: 6, paddingBottom: 4, alignItems: "center" },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: posRadius.pill,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.card
  },
  typeEmoji: { fontSize: 12 },
  typeLabel: { fontSize: 11, fontWeight: "700", color: posColors.textSecondary },
  scrollFlex: { flex: 1, minHeight: 0 },
  scroll: { paddingHorizontal: posSpacing.md, paddingVertical: posSpacing.sm, gap: 0, flexGrow: 1 },
  hint: {
    textAlign: "center",
    color: posColors.textDim,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 24
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: posColors.border,
    gap: 8
  },
  lineRowPressed: { opacity: 0.75, backgroundColor: posColors.cardHover },
  lineInfo: { flex: 1, minWidth: 0 },
  lineName: { fontSize: 14, fontWeight: "700", color: posColors.text },
  lineUnit: { fontSize: 11, color: posColors.textDim, marginTop: 2 },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  qtyBtnAdd: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  qtyBtnText: { fontSize: 16, fontWeight: "800", color: posColors.text },
  qtyBtnTextAdd: { fontSize: 16, fontWeight: "800", color: "#fff" },
  qtyValue: {
    minWidth: 22,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
    color: posColors.text,
    fontVariant: ["tabular-nums"]
  },
  qtyReadonly: { fontSize: 13, fontWeight: "700", color: posColors.textSecondary },
  delBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: posColors.dangerMuted
  },
  delBtnText: { fontSize: 12, fontWeight: "800", color: posColors.danger },
  lineTotal: {
    minWidth: 64,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "800",
    color: posColors.text,
    fontVariant: ["tabular-nums"]
  },
  cashOptional: { gap: 6 },
  cashToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 2
  },
  cashToggleText: { fontSize: 12, fontWeight: "700", color: posColors.textSecondary },
  cashToggleHint: { fontSize: 12, fontWeight: "800", color: posColors.success },
  cashRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  cashInput: { flex: 1, paddingVertical: 10 },
  changeBox: {
    minWidth: 88,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: posRadius.md,
    backgroundColor: posColors.successMuted,
    alignItems: "center"
  },
  changeLabel: { fontSize: 10, fontWeight: "700", color: posColors.success },
  changeValue: { fontSize: 14, fontWeight: "900", color: posColors.success },
  footer: {
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: posColors.borderStrong,
    paddingHorizontal: posSpacing.md,
    paddingTop: posSpacing.sm,
    paddingBottom: posSpacing.md,
    gap: 10,
    backgroundColor: posColors.secondary
  },
  totals: { gap: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 13, fontWeight: "600", color: posColors.textSecondary },
  totalValue: { fontSize: 13, fontWeight: "700", color: posColors.text },
  totalLabelMuted: { fontSize: 12, fontWeight: "600", color: posColors.textDim },
  totalValueMuted: { fontSize: 12, fontWeight: "600", color: posColors.textDim },
  grandRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: posColors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  grandLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  grandLabel: { fontSize: 15, fontWeight: "800", color: posColors.text },
  discountIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  discountIconText: { fontSize: 12, fontWeight: "900", color: posColors.warning },
  grandValue: { fontSize: 24, fontWeight: "900", color: posColors.success, letterSpacing: -0.4 },
  payMethods: { flexDirection: "row", gap: 6 },
  payMethod: {
    flex: 1,
    minHeight: 44,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.card,
    alignItems: "center",
    justifyContent: "center"
  },
  payMethodOn: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  payMethodText: { fontSize: 13, fontWeight: "800", color: posColors.textSecondary },
  payMethodTextOn: { color: "#fff" },
  actionStack: { gap: 8 },
  primaryBtn: {
    minHeight: 56,
    borderRadius: posRadius.lg,
    backgroundColor: posColors.success,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: 0.3 },
  secondaryRow: { flexDirection: "row", gap: 6 },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: posRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: posColors.card
  },
  holdBtn: { borderColor: "rgba(245,158,11,0.45)" },
  draftBtn: { borderColor: "rgba(59,130,246,0.45)" },
  cancelBtn: { borderColor: "rgba(239,68,68,0.45)" },
  secondaryBtnText: { fontSize: 13, fontWeight: "800" },
  heldBlock: { gap: 4 },
  heldRow: {
    ...posCard(),
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8
  },
  heldLabel: { flex: 1, fontSize: 12, fontWeight: "600", color: posColors.textSecondary },
  heldResume: { fontSize: 12, fontWeight: "800", color: posColors.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: posSpacing.lg
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    ...posCard(),
    padding: posSpacing.lg,
    gap: posSpacing.sm
  },
  modalTitle: { ...posType.h2, fontSize: 16 },
  discountModes: { flexDirection: "row", gap: 6 },
  discountModeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    alignItems: "center",
    backgroundColor: posColors.bg
  },
  discountModeChipOn: { backgroundColor: posColors.primaryMuted, borderColor: posColors.primary },
  discountModeText: { fontSize: 13, fontWeight: "800", color: posColors.textSecondary },
  discountModeTextOn: { color: posColors.primary },
  couponError: { fontSize: 11, color: posColors.danger, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: posSpacing.sm, marginTop: posSpacing.xs },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: posRadius.md, alignItems: "center" },
  modalBtnGhost: { backgroundColor: posColors.card, borderWidth: 1, borderColor: posColors.border },
  modalBtnPrimary: { backgroundColor: posColors.primary },
  modalBtnGhostText: { fontSize: 13, fontWeight: "800", color: posColors.textSecondary },
  modalBtnPrimaryText: { fontSize: 13, fontWeight: "800", color: "#fff" }
});
