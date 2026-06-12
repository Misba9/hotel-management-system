import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SplitPaymentLine } from "./pos-types";
import { PosInput, PosSectionTitle } from "./pos-ui";
import { posCard, posColors, posSpacing, posType } from "./pos-theme";

type Props = {
  grandTotal: number;
  lines: SplitPaymentLine[];
  onChange: (lines: SplitPaymentLine[]) => void;
};

const METHODS = ["Cash", "UPI", "Card"];

export function PosSplitPayment({ grandTotal, lines, onChange }: Props) {
  const paid = useMemo(() => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0), [lines]);
  const remaining = Math.round((grandTotal - paid) * 100) / 100;

  const update = (index: number, amount: string) => {
    const next = [...lines];
    next[index] = { ...next[index], amount: Number(amount) || 0 };
    onChange(next);
  };

  const rows = lines.length ? lines : METHODS.map((m) => ({ method: m, amount: 0 }));

  return (
    <View style={[posCard(), styles.wrap]}>
      <PosSectionTitle title="Split Payment" />
      <Text style={posType.small}>Total {formatMoney(grandTotal)}</Text>
      {rows.map((row, i) => (
        <View key={row.method} style={styles.row}>
          <Text style={styles.method}>{row.method}</Text>
          <PosInput
            value={String(row.amount || "")}
            onChangeText={(v) => update(i, v)}
            keyboardType="decimal-pad"
            placeholder="0"
            style={styles.input}
          />
        </View>
      ))}
      <Text style={[styles.remaining, remaining === 0 ? styles.ok : styles.warn]}>
        Remaining {formatMoney(remaining)}
      </Text>
    </View>
  );
}

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

const styles = StyleSheet.create({
  wrap: { padding: posSpacing.md, gap: posSpacing.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  method: { fontSize: 13, fontWeight: "700", color: posColors.text, width: 60 },
  input: { flex: 1, maxWidth: 120, paddingVertical: 8, textAlign: "right" },
  remaining: { fontSize: 14, fontWeight: "800", marginTop: posSpacing.sm },
  ok: { color: posColors.success },
  warn: { color: posColors.warning }
});
