import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  onKitchen?: () => void;
  onDiscount?: () => void;
};

const TOOLBAR_ICON = 24;

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
  onCashOut,
  onKitchen,
  onDiscount
}: Props) {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const iconSize = layout.isTablet ? TOOLBAR_ICON : layout.iconSize;
  const btnH = layout.buttonHeight;

  if (layout.isPhone) {
    return (
      <View style={[styles.mobileBar, { paddingBottom: Math.max(insets.bottom, posSpacing.sm) }]}>
        {onMenu ? (
          <MobileAction icon="more" label="Menu" onPress={onMenu} size={iconSize} minTouch={layout.minTouch} />
        ) : null}
        {onBill ? (
          <Pressable
            onPress={onBill}
            style={[styles.mobileAction, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}
          >
            <Text style={{ fontSize: iconSize }}>🧾</Text>
            <Text style={styles.mobileLabel}>Bill</Text>
          </Pressable>
        ) : null}
        <MobileAction icon="plus" label="New" onPress={onNewOrder} size={iconSize} minTouch={layout.minTouch} />
        <MobileAction icon="print" label="Print" onPress={onPrint} size={iconSize} minTouch={layout.minTouch} />
        <Pressable
          onPress={onPay}
          style={[styles.payBtn, { minHeight: btnH, borderRadius: layout.radius }]}
        >
          <PosIcon name="pay" size={iconSize} color="#fff" />
          <Text style={[styles.payText, { fontSize: 16 }]}>Pay</Text>
        </Pressable>
        <MobileAction icon="more" label="More" onPress={onMore} size={iconSize} minTouch={layout.minTouch} />
      </View>
    );
  }

  return (
    <ResponsiveToolbar>
      <View style={styles.actionsWrap}>
        <ToolbarBtn label="New Order" emoji="🧾" onPress={onNewOrder} height={btnH} />
        <ToolbarBtn label="Customer" emoji="👤" onPress={onNewCustomer} height={btnH} />
        <ToolbarBtn label="Expense" emoji="💸" onPress={onExpense} height={btnH} />
        <ToolbarBtn label="Cash In" emoji="📥" onPress={onCashIn} height={btnH} />
        <ToolbarBtn label="Cash Out" emoji="📤" onPress={onCashOut} height={btnH} />
        <ToolbarBtn label="Kitchen" emoji="👨‍🍳" onPress={onKitchen} height={btnH} />
        <ToolbarBtn label="Print" emoji="🖨" onPress={onPrint} height={btnH} />
        <ToolbarBtn label="Discount" emoji="%" onPress={onDiscount} height={btnH} />
        <Pressable
          onPress={onPay}
          style={[styles.tabletPayBtn, { minHeight: btnH, borderRadius: layout.radius }]}
        >
          <PosIcon name="pay" size={iconSize} color="#fff" />
          <Text style={styles.payText}>Payment</Text>
        </Pressable>
        <Pressable
          onPress={onMore}
          style={[styles.moreBtn, { minHeight: btnH, borderRadius: layout.radius }]}
          accessibilityLabel="More shortcuts"
        >
          <PosIcon name="more" size={22} color={posColors.textSecondary} />
          <Text style={styles.moreLabel}>More</Text>
        </Pressable>
      </View>
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
  height
}: {
  label: string;
  emoji: string;
  onPress?: () => void;
  height: number;
}) {
  if (!onPress) return null;
  return (
    <Pressable onPress={onPress} style={[styles.toolbarBtn, { minHeight: height }]}>
      <Text style={styles.toolbarEmoji}>{emoji}</Text>
      <Text style={styles.toolbarLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: posSpacing.sm,
    width: "100%",
    flexGrow: 1
  },
  mobileBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: posSpacing.sm,
    paddingHorizontal: posSpacing.md,
    backgroundColor: posColors.secondary,
    borderTopWidth: 1,
    borderTopColor: posColors.borderStrong,
    ...posShadow(true),
    width: "100%"
  },
  mobileAction: { alignItems: "center", justifyContent: "center", gap: 2, padding: posSpacing.xs, flex: 1 },
  mobileLabel: { fontSize: 11, fontWeight: "700", color: posColors.textSecondary },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: posColors.success,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexShrink: 1,
    justifyContent: "center"
  },
  tabletPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: posColors.success,
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginLeft: "auto"
  },
  payText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.borderStrong,
    borderRadius: posRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexGrow: 1,
    flexBasis: "auto",
    justifyContent: "center",
    minWidth: 120
  },
  toolbarEmoji: { fontSize: 18 },
  toolbarLabel: { fontWeight: "700", color: posColors.text, fontSize: 14 },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  moreLabel: { fontWeight: "700", color: posColors.textSecondary, fontSize: 14 }
});
