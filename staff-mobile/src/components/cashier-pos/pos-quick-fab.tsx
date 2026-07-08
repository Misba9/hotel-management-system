import React, { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
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
  enabled?: boolean;
};

/** Floating quick actions — phone only; tablets use bottom toolbar */
export const PosQuickFab = memo(function PosQuickFab({
  onNewOrder,
  onNewCustomer,
  onExpense,
  onCashIn,
  onCashOut,
  enabled = true
}: Props) {
  const [open, setOpen] = useState(false);
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  if (!enabled || layout.isTablet) return null;

  const fabSize = layout.scale(52);
  const bottomOffset = Math.max(insets.bottom, posSpacing.md) + layout.scale(72);

  const actions: FabAction[] = [
    { id: "order", label: "New Order", emoji: "🧾", onPress: () => { setOpen(false); onNewOrder(); } },
    { id: "customer", label: "New Customer", emoji: "👤", onPress: () => { setOpen(false); onNewCustomer(); } },
    { id: "expense", label: "Expense", emoji: "💸", onPress: () => { setOpen(false); onExpense(); } },
    { id: "cashin", label: "Cash In", emoji: "📥", onPress: () => { setOpen(false); onCashIn(); } },
    { id: "cashout", label: "Cash Out", emoji: "📤", onPress: () => { setOpen(false); onCashOut(); } }
  ];

  return (
    <View style={[styles.wrap, { right: layout.padding, bottom: bottomOffset }]} pointerEvents="box-none">
      {open ? (
        <View style={[styles.menu, { borderRadius: layout.radius }]}>
          {actions.map((a) => (
            <Pressable key={a.id} onPress={a.onPress} style={[styles.menuItem, { minHeight: layout.minTouch }]}>
              <Text style={{ fontSize: layout.moderateScale(16) }}>{a.emoji}</Text>
              <Text style={[styles.menuLabel, { fontSize: layout.moderateScale(13) }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.fab,
          open && styles.fabOpen,
          { width: fabSize, height: fabSize, borderRadius: fabSize / 2 }
        ]}
        accessibilityLabel={open ? "Close quick actions" : "Open quick actions"}
      >
        <Text style={[styles.fabIcon, { fontSize: layout.moderateScale(24) }]}>{open ? "✕" : "+"}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    zIndex: 200,
    alignItems: "flex-end",
    gap: posSpacing.sm
  },
  menu: {
    backgroundColor: posColors.card,
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
  menuLabel: { fontWeight: "700", color: posColors.text },
  fab: {
    backgroundColor: posColors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...posShadow(true)
  },
  fabOpen: { backgroundColor: posColors.card, borderWidth: 1, borderColor: posColors.border },
  fabIcon: { fontWeight: "300", color: "#fff" }
});
