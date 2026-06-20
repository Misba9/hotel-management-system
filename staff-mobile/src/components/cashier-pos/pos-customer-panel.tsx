import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import { findCustomerByPhone } from "../../lib/pos/customer-insights";
import { PosBadge, PosInput, PosSectionTitle } from "./pos-ui";
import { posCard, posColors, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  phone: string;
  customerName: string;
  guestCount: string;
  gstNumber: string;
  address: string;
  tableLabel: string;
  orders: StaffOrderRow[];
  onPhoneChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onGuestCountChange: (v: string) => void;
  onGstChange: (v: string) => void;
  onAddressChange: (v: string) => void;
};

export function PosCustomerPanel({
  phone,
  customerName,
  guestCount,
  gstNumber,
  address,
  tableLabel,
  orders,
  onPhoneChange,
  onNameChange,
  onGuestCountChange,
  onGstChange,
  onAddressChange
}: Props) {
  const hasDetails = Boolean(phone || customerName || guestCount || gstNumber || address);
  const [expanded, setExpanded] = useState(hasDetails);
  const insight = useMemo(() => findCustomerByPhone(orders, phone), [orders, phone]);

  const summary = customerName || phone || "Add customer details";

  return (
    <View style={[posCard(), styles.wrap]}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.dropdownHeader, pressed && styles.dropdownHeaderPressed]}
      >
        <View style={styles.dropdownLeft}>
          <PosSectionTitle title="Customer" />
          <Text style={styles.dropdownLabel} numberOfLines={1}>
            + New Customer · {summary}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.form}>
          <PosInput value={phone} onChangeText={onPhoneChange} placeholder="Phone" keyboardType="phone-pad" style={styles.field} />
          <PosInput value={customerName} onChangeText={onNameChange} placeholder="Customer name" style={styles.field} />

          <View style={styles.detailGrid}>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Table</Text>
              <Text style={styles.detailValue}>{tableLabel || "—"}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Guests</Text>
              <PosInput value={guestCount} onChangeText={onGuestCountChange} placeholder="0" keyboardType="number-pad" style={styles.miniInput} />
            </View>
          </View>

          <PosInput value={gstNumber} onChangeText={onGstChange} placeholder="GST Number" style={styles.field} />
          <PosInput value={address} onChangeText={onAddressChange} placeholder="Delivery address" style={styles.field} multiline />

          {insight ? (
            <View style={styles.insight}>
              <View style={styles.insightTop}>
                <Text style={posType.h3}>{insight.name}</Text>
                {insight.isVip ? <PosBadge label="VIP" color={posColors.warning} /> : null}
              </View>
              <Text style={posType.small}>Visits {insight.visits} · Spend ₹{insight.totalSpend.toFixed(0)}</Text>
              <Text style={posType.small}>Points {insight.rewardPoints} · Last {insight.lastOrderAt?.toLocaleDateString() ?? "—"}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: posSpacing.md, gap: posSpacing.xs },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: posSpacing.sm,
    paddingVertical: 2
  },
  dropdownHeaderPressed: { opacity: 0.85 },
  dropdownLeft: { flex: 1, minWidth: 0, gap: 2 },
  dropdownLabel: { fontSize: 11, fontWeight: "700", color: posColors.primary },
  chevron: { fontSize: 10, color: posColors.textDim, paddingHorizontal: 4 },
  form: { marginTop: posSpacing.xs, gap: 0 },
  field: { marginTop: posSpacing.xs },
  detailGrid: { flexDirection: "row", gap: posSpacing.sm, marginTop: posSpacing.xs },
  detailCell: { flex: 1 },
  detailLabel: { ...posType.label, fontSize: 8, marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: "700", color: posColors.text },
  miniInput: { paddingVertical: 6, fontSize: 13 },
  insight: { marginTop: posSpacing.sm, padding: posSpacing.sm, backgroundColor: posColors.bg, borderRadius: posRadius.md },
  insightTop: { flexDirection: "row", alignItems: "center", gap: 8 }
});
