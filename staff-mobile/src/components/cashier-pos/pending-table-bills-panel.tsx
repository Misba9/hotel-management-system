import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCashierRequestedTableBills } from "../../hooks/use-cashier-requested-table-bills";
import { confirmTableOrderPayment, formatConfirmPaymentError } from "../../services/confirm-table-order-payment";
import { space, radius } from "../../theme/design-tokens";
import { staffColors } from "../../theme/staff-ui";

type Props = {
  enabled?: boolean;
};

export function PendingTableBillsPanel({ enabled = true }: Props) {
  const { bills, loading, error } = useCashierRequestedTableBills(enabled);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const onConfirm = useCallback(async (orderId: string, tableNumber: number) => {
    setConfirmingId(orderId);
    try {
      await confirmTableOrderPayment(orderId);
      Alert.alert("Payment recorded", `Table ${tableNumber} is free and the order is completed.`);
    } catch (e) {
      Alert.alert("Could not confirm", formatConfirmPaymentError(e));
    } finally {
      setConfirmingId(null);
    }
  }, []);

  if (!enabled) return null;
  if (loading && bills.length === 0) return null;
  if (error && bills.length === 0) return null;
  if (bills.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityLabel="Table bills waiting for payment">
      <Text style={styles.title}>Bills to collect</Text>
      <Text style={styles.sub}>Table orders that requested a bill — confirm after payment.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {bills.map((b, index) => {
          const busy = confirmingId === b.id;
          return (
            <View key={b.id} style={[styles.card, index < bills.length - 1 && styles.cardSpacing]}>
              <Text style={styles.table}>Table {b.tableNumber}</Text>
              <Text style={styles.amount}>₹{b.totalAmount.toFixed(0)}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                #{b.id.slice(0, 8)}…
              </Text>
              <Pressable
                onPress={() => void onConfirm(b.id, b.tableNumber)}
                disabled={busy}
                style={({ pressed }) => [styles.btn, busy && styles.btnDisabled, pressed && !busy && styles.btnPressed]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>Confirm payment</Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: staffColors.border,
    backgroundColor: "#fffbeb",
    paddingVertical: space.md,
    paddingHorizontal: space.lg
  },
  title: { fontSize: 15, fontWeight: "800", color: staffColors.text },
  sub: { marginTop: 4, fontSize: 12, color: staffColors.muted, marginBottom: space.sm },
  row: { flexDirection: "row", paddingRight: space.lg },
  cardSpacing: { marginRight: space.md },
  card: {
    width: 168,
    backgroundColor: staffColors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#FCD34D"
  },
  table: { fontSize: 16, fontWeight: "800", color: staffColors.text },
  amount: { marginTop: 4, fontSize: 18, fontWeight: "900", color: staffColors.accent },
  meta: { marginTop: 4, fontSize: 11, color: staffColors.muted },
  btn: {
    marginTop: space.sm,
    backgroundColor: staffColors.success,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    alignItems: "center",
    minHeight: 40,
    justifyContent: "center"
  },
  btnPressed: { opacity: 0.9 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 }
});
