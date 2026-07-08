import React, { memo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
import { PosIcon } from "./pos-icons";
import { ResponsiveToolbar } from "./responsive/ResponsiveToolbar";
import { posColors, posRadius, posShadow, posSpacing } from "./pos-theme";

type Props = {
  isMobile?: boolean;
  onNewOrder: () => void;
  onPrint: () => void;
  onPay: () => void;
  onMore: () => void;
  onMenu?: () => void;
  onBill?: () => void;
  showFabActions?: boolean;
  onNewCustomer?: () => void;
  onExpense?: () => void;
  onCashIn?: () => void;
  onCashOut?: () => void;
};

const SHORTCUTS = [
  { key: "F1", label: "Search" },
  { key: "F2", label: "New" },
  { key: "F3", label: "Payment" },
  { key: "F4", label: "Print" },
  { key: "F5", label: "Hold" },
  { key: "F6", label: "Discount" },
  { key: "F7", label: "Customer" },
  { key: "F8", label: "Kitchen" },
  { key: "ESC", label: "Cancel" },
  { key: "CTRL+B", label: "Barcode" }
];

export const PosBottomBar = memo(function PosBottomBar({
  onNewOrder,
  onPrint,
  onPay,
  onMore,
  onMenu,
  onBill,
  showFabActions,
  onNewCustomer,
  onExpense,
  onCashIn,
  onCashOut
}: Props) {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const iconSize = layout.iconSize;

  if (layout.isPhone) {
    return (
      <View style={[styles.mobileBar, { paddingBottom: Math.max(insets.bottom, posSpacing.sm) }]}>
        {onMenu ? <MobileAction icon="more" label="Menu" onPress={onMenu} size={iconSize} minTouch={layout.minTouch} /> : null}
        {onBill ? (
          <Pressable onPress={onBill} style={[styles.mobileAction, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}>
            <Text style={{ fontSize: iconSize }}>🧾</Text>
            <Text style={styles.mobileLabel}>Bill</Text>
          </Pressable>
        ) : null}
        <MobileAction icon="plus" label="New" onPress={onNewOrder} size={iconSize} minTouch={layout.minTouch} />
        <MobileAction icon="print" label="Print" onPress={onPrint} size={iconSize} minTouch={layout.minTouch} />
        <Pressable onPress={onPay} style={[styles.payBtn, { minHeight: layout.minTouch, borderRadius: layout.radius }]}>
          <PosIcon name="pay" size={iconSize} color="#fff" />
          <Text style={[styles.payText, { fontSize: layout.moderateScale(15) }]}>Pay</Text>
        </Pressable>
        <MobileAction icon="more" label="More" onPress={onMore} size={iconSize} minTouch={layout.minTouch} />
      </View>
    );
  }

  return (
    <ResponsiveToolbar>
      {SHORTCUTS.map((s) => (
        <View key={s.key} style={styles.shortcut}>
          <View style={[styles.keyCap, { borderRadius: layout.radius * 0.5 }]}>
            <Text style={[styles.keyText, { fontSize: layout.moderateScale(10) }]}>{s.key}</Text>
          </View>
          <Text style={[styles.shortcutLabel, { fontSize: layout.moderateScale(11) }]}>{s.label}</Text>
        </View>
      ))}
      {showFabActions ? (
        <>
          <ToolbarBtn label="New Order" emoji="🧾" onPress={onNewOrder} layout={layout} />
          <ToolbarBtn label="Customer" emoji="👤" onPress={onNewCustomer} layout={layout} />
          <ToolbarBtn label="Expense" emoji="💸" onPress={onExpense} layout={layout} />
          <ToolbarBtn label="Cash In" emoji="📥" onPress={onCashIn} layout={layout} />
          <ToolbarBtn label="Cash Out" emoji="📤" onPress={onCashOut} layout={layout} />
        </>
      ) : null}
      <Pressable
        onPress={onPay}
        style={[styles.tabletPayBtn, { minHeight: layout.minTouch, borderRadius: layout.radius, paddingHorizontal: layout.padding }]}
      >
        <PosIcon name="pay" size={iconSize} color="#fff" />
        <Text style={[styles.payText, { fontSize: layout.moderateScale(15) }]}>Pay</Text>
      </Pressable>
    </ResponsiveToolbar>
  );
});

function MobileAction({
  icon,
  label,
  onPress,
  size,
  minTouch
}: {
  icon: "plus" | "print" | "more";
  label: string;
  onPress: () => void;
  size: number;
  minTouch: number;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.mobileAction, { minWidth: minTouch, minHeight: minTouch }]}>
      <PosIcon name={icon} size={size} color={posColors.textSecondary} />
      <Text style={styles.mobileLabel}>{label}</Text>
    </Pressable>
  );
}

function ToolbarBtn({
  label,
  emoji,
  onPress,
  layout
}: {
  label: string;
  emoji: string;
  onPress?: () => void;
  layout: ReturnType<typeof useResponsiveLayout>;
}) {
  if (!onPress) return null;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toolbarBtn, { minHeight: layout.minTouch, borderRadius: layout.radius, paddingHorizontal: layout.padding * 0.6 }]}
    >
      <Text style={{ fontSize: layout.moderateScale(16) }}>{emoji}</Text>
      <Text style={[styles.toolbarLabel, { fontSize: layout.moderateScale(12) }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shortcut: { flexDirection: "row", alignItems: "center", gap: 6 },
  keyCap: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  keyText: {
    fontWeight: "800",
    color: posColors.textSecondary,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined
  },
  shortcutLabel: { color: posColors.textDim, fontWeight: "600" },
  mobileBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: posSpacing.xs,
    paddingHorizontal: posSpacing.sm,
    backgroundColor: posColors.secondary,
    borderTopWidth: 1,
    borderTopColor: posColors.border,
    ...posShadow(true)
  },
  mobileAction: { alignItems: "center", justifyContent: "center", gap: 2, padding: posSpacing.xs, flex: 1 },
  mobileLabel: { fontSize: 10, fontWeight: "700", color: posColors.textSecondary },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: posColors.success,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 1,
    justifyContent: "center"
  },
  tabletPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: posColors.success,
    paddingVertical: 10,
    marginLeft: "auto"
  },
  payText: { color: "#fff", fontWeight: "900" },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  toolbarLabel: { fontWeight: "700", color: posColors.text }
});
