import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { posColors, posRadius, posShadow, posSpacing } from "./pos-theme";

type FabAction = {
  id: string;
  label: string;
  emoji: string;
  onPress: () => void;
};

type Props = {
  onNewOrder: () => void;
  onNewCustomer: () => void;
  onExpense: () => void;
  onCashIn: () => void;
  onCashOut: () => void;
};

export function PosQuickFab({ onNewOrder, onNewCustomer, onExpense, onCashIn, onCashOut }: Props) {
  const [open, setOpen] = useState(false);

  const actions: FabAction[] = [
    { id: "order", label: "New Order", emoji: "🧾", onPress: () => { setOpen(false); onNewOrder(); } },
    { id: "customer", label: "New Customer", emoji: "👤", onPress: () => { setOpen(false); onNewCustomer(); } },
    { id: "expense", label: "Expense", emoji: "💸", onPress: () => { setOpen(false); onExpense(); } },
    { id: "cashin", label: "Cash In", emoji: "📥", onPress: () => { setOpen(false); onCashIn(); } },
    { id: "cashout", label: "Cash Out", emoji: "📤", onPress: () => { setOpen(false); onCashOut(); } }
  ];

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {open ? (
        <View style={styles.menu}>
          {actions.map((a) => (
            <Pressable key={a.id} onPress={a.onPress} style={styles.menuItem}>
              <Text style={styles.menuEmoji}>{a.emoji}</Text>
              <Text style={styles.menuLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable onPress={() => setOpen((v) => !v)} style={[styles.fab, open && styles.fabOpen]}>
        <Text style={styles.fabIcon}>{open ? "✕" : "+"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: posSpacing.lg,
    bottom: 72,
    zIndex: 200,
    alignItems: "flex-end",
    gap: posSpacing.sm
  },
  menu: {
    backgroundColor: posColors.card,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    padding: posSpacing.xs,
    gap: 2,
    ...posShadow(true)
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    paddingHorizontal: posSpacing.md,
    paddingVertical: posSpacing.sm,
    borderRadius: posRadius.sm
  },
  menuEmoji: { fontSize: 16 },
  menuLabel: { fontSize: 13, fontWeight: "700", color: posColors.text },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: posColors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...posShadow(true)
  },
  fabOpen: { backgroundColor: posColors.card, borderWidth: 1, borderColor: posColors.border },
  fabIcon: { fontSize: 24, fontWeight: "300", color: "#fff" }
});
