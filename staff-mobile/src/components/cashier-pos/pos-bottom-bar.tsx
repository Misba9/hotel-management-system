import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { PosIcon } from "./pos-icons";
import { posColors, posRadius, posShadow, posSpacing } from "./pos-theme";

type Props = {
  isMobile: boolean;
  onNewOrder: () => void;
  onPrint: () => void;
  onPay: () => void;
  onMore: () => void;
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

export function PosBottomBar({ isMobile, onNewOrder, onPrint, onPay, onMore }: Props) {
  if (isMobile) {
    return (
      <View style={styles.mobileBar}>
        <MobileAction icon="plus" label="New" onPress={onNewOrder} />
        <MobileAction icon="print" label="Print" onPress={onPrint} />
        <Pressable onPress={onPay} style={styles.payBtn}>
          <PosIcon name="pay" size={20} color="#fff" />
          <Text style={styles.payText}>Pay</Text>
        </Pressable>
        <MobileAction icon="more" label="More" onPress={onMore} />
      </View>
    );
  }

  return (
    <View style={styles.desktopBar}>
      {SHORTCUTS.map((s) => (
        <View key={s.key} style={styles.shortcut}>
          <View style={styles.keyCap}>
            <Text style={styles.keyText}>{s.key}</Text>
          </View>
          <Text style={styles.shortcutLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

function MobileAction({
  icon,
  label,
  onPress
}: {
  icon: "plus" | "print" | "more";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.mobileAction}>
      <PosIcon name={icon} size={20} color={posColors.textSecondary} />
      <Text style={styles.mobileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  desktopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: posSpacing.md,
    paddingVertical: posSpacing.xs,
    paddingHorizontal: posSpacing.lg,
    backgroundColor: posColors.secondary,
    borderTopWidth: 1,
    borderTopColor: posColors.border,
    minHeight: 36
  },
  shortcut: { flexDirection: "row", alignItems: "center", gap: 6 },
  keyCap: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  keyText: {
    fontSize: 10,
    fontWeight: "800",
    color: posColors.textSecondary,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined
  },
  shortcutLabel: { fontSize: 11, color: posColors.textDim, fontWeight: "600" },
  mobileBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: posSpacing.sm,
    paddingHorizontal: posSpacing.md,
    backgroundColor: posColors.secondary,
    borderTopWidth: 1,
    borderTopColor: posColors.border,
    ...posShadow(true)
  },
  mobileAction: { alignItems: "center", gap: 4, padding: posSpacing.sm, minWidth: 56 },
  mobileLabel: { fontSize: 10, fontWeight: "700", color: posColors.textSecondary },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: posColors.success,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: posRadius.lg,
    minWidth: 120,
    justifyContent: "center"
  },
  payText: { color: "#fff", fontSize: 15, fontWeight: "900" }
});
