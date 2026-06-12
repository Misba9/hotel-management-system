import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import { findCustomerByPhone } from "../../lib/pos/customer-insights";
import { PosBadge, PosInput, PosSectionTitle } from "./pos-ui";
import { posCard, posColors, posSpacing, posType } from "./pos-theme";

type Props = {
  mode: "walkin" | "existing" | "new";
  phone: string;
  customerName: string;
  orders: StaffOrderRow[];
  onModeChange: (m: "walkin" | "existing" | "new") => void;
  onPhoneChange: (v: string) => void;
  onNameChange: (v: string) => void;
};

export function PosCustomerPanel({ mode, phone, customerName, orders, onModeChange, onPhoneChange, onNameChange }: Props) {
  const insight = useMemo(() => findCustomerByPhone(orders, phone), [orders, phone]);

  return (
    <View style={[posCard(), styles.wrap]}>
      <PosSectionTitle title="Customer" />
      <View style={styles.modeRow}>
        {(["walkin", "existing", "new"] as const).map((m) => (
          <Pressable key={m} onPress={() => onModeChange(m)} style={[styles.modeChip, mode === m && styles.modeOn]}>
            <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>
              {m === "walkin" ? "Walk-in" : m === "existing" ? "Existing" : "New"}
            </Text>
          </Pressable>
        ))}
      </View>
      {(mode === "existing" || mode === "new") && (
        <>
          <PosInput value={phone} onChangeText={onPhoneChange} placeholder="Phone search" keyboardType="phone-pad" style={{ marginTop: posSpacing.sm }} />
          <PosInput value={customerName} onChangeText={onNameChange} placeholder="Customer name" style={{ marginTop: posSpacing.sm }} />
        </>
      )}
      {insight ? (
        <View style={styles.insight}>
          <View style={styles.insightTop}>
            <Text style={posType.h3}>{insight.name}</Text>
            {insight.isVip ? <PosBadge label="VIP" color={posColors.warning} /> : null}
          </View>
          <Text style={posType.small}>Visits {insight.visits} · Spend ₹{insight.totalSpend.toFixed(0)}</Text>
          <Text style={posType.small}>Points {insight.rewardPoints} · Last {insight.lastOrderAt?.toLocaleDateString() ?? "—"}</Text>
        </View>
      ) : mode === "walkin" ? (
        <Text style={[posType.small, { marginTop: posSpacing.sm }]}>Walk-in customer</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: posSpacing.md, gap: posSpacing.xs },
  modeRow: { flexDirection: "row", gap: posSpacing.sm, marginTop: posSpacing.sm },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: posColors.border
  },
  modeOn: { backgroundColor: posColors.primaryMuted, borderColor: posColors.primary },
  modeText: { fontSize: 11, fontWeight: "800", color: posColors.textSecondary },
  modeTextOn: { color: posColors.primary },
  insight: { marginTop: posSpacing.md, padding: posSpacing.sm, backgroundColor: posColors.bg, borderRadius: 8 },
  insightTop: { flexDirection: "row", alignItems: "center", gap: 8 }
});
