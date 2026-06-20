import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PaymentMethodId } from "../../../services/restaurant-orders";
import type { PosSettingsDoc } from "@shared/types/pos-settings";
import { PosButton, PosInput } from "./pos-ui";
import { posCard, posColors, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  method: PaymentMethodId;
  grandTotal: number;
  posSettings: PosSettingsDoc;
  cashReceived: string;
  onCashReceivedChange: (v: string) => void;
  onConfirmManual: () => void;
  onConfirmRazorpay: () => void;
  busy: boolean;
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

export function PosPaymentFlow({
  method,
  grandTotal,
  posSettings,
  cashReceived,
  onCashReceivedChange,
  onConfirmManual,
  onConfirmRazorpay,
  busy
}: Props) {
  const change = useMemo(() => {
    const received = Number(cashReceived) || 0;
    return Math.max(0, Math.round((received - grandTotal) * 100) / 100);
  }, [cashReceived, grandTotal]);

  const useRazorpay = posSettings.paymentProvider === "razorpay" && (method === "upi" || method === "card");

  if (method === "cash") {
    return (
      <View style={[posCard(), styles.box]}>
        <Text style={posType.h3}>Cash payment</Text>
        <Text style={posType.small}>Amount due: {formatMoney(grandTotal)}</Text>
        <PosInput
          value={cashReceived}
          onChangeText={onCashReceivedChange}
          placeholder="Cash received"
          keyboardType="decimal-pad"
          style={styles.field}
        />
        {Number(cashReceived) > 0 ? (
          <Text style={styles.change}>Change: {formatMoney(change)}</Text>
        ) : null}
        <PosButton
          label={busy ? "Processing…" : "Confirm cash & print"}
          onPress={onConfirmManual}
          disabled={busy || Number(cashReceived) < grandTotal}
          fullWidth
        />
      </View>
    );
  }

  if (method === "upi" && !useRazorpay) {
    const vpa = posSettings.upiVpa?.trim() || "Configure UPI in Admin → Settings → Payments";
    return (
      <View style={[posCard(), styles.box]}>
        <Text style={posType.h3}>UPI payment</Text>
        <Text style={posType.small}>Scan or pay to merchant UPI</Text>
        <View style={styles.vpaBox}>
          <Text style={styles.vpaLabel}>UPI ID</Text>
          <Text style={styles.vpaValue}>{vpa}</Text>
          {posSettings.upiBankName ? <Text style={posType.small}>{posSettings.upiBankName}</Text> : null}
        </View>
        <Text style={posType.small}>Amount: {formatMoney(grandTotal)}</Text>
        <PosButton label={busy ? "Processing…" : "Payment received — print"} onPress={onConfirmManual} disabled={busy} fullWidth />
      </View>
    );
  }

  if (method === "card" && !useRazorpay) {
    return (
      <View style={[posCard(), styles.box]}>
        <Text style={posType.h3}>Card payment</Text>
        <Text style={posType.small}>Process card on your terminal, then confirm.</Text>
        <Text style={posType.small}>Amount: {formatMoney(grandTotal)}</Text>
        <PosButton label={busy ? "Processing…" : "Card received — print"} onPress={onConfirmManual} disabled={busy} fullWidth />
      </View>
    );
  }

  if (useRazorpay) {
    return (
      <View style={[posCard(), styles.box]}>
        <Text style={posType.h3}>Razorpay</Text>
        <Text style={posType.small}>
          Pay {formatMoney(grandTotal)} via Razorpay ({method === "upi" ? "UPI" : "Card"}). Configured in Admin panel.
        </Text>
        <PosButton label={busy ? "Opening…" : "Pay with Razorpay"} onPress={onConfirmRazorpay} disabled={busy} fullWidth />
      </View>
    );
  }

  if (method === "wallet") {
    return (
      <View style={[posCard(), styles.box]}>
        <Text style={posType.h3}>Wallet</Text>
        <Text style={posType.small}>Amount: {formatMoney(grandTotal)}</Text>
        <PosButton label={busy ? "Processing…" : "Wallet paid — print"} onPress={onConfirmManual} disabled={busy} fullWidth />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  box: { padding: posSpacing.md, gap: posSpacing.sm, marginTop: posSpacing.sm },
  field: { marginTop: posSpacing.xs },
  change: { fontSize: 14, fontWeight: "800", color: posColors.success },
  vpaBox: {
    padding: posSpacing.md,
    borderRadius: posRadius.md,
    backgroundColor: posColors.bg,
    borderWidth: 1,
    borderColor: posColors.border,
    gap: 4
  },
  vpaLabel: { ...posType.label, fontSize: 9 },
  vpaValue: { fontSize: 16, fontWeight: "900", color: posColors.primary }
});
