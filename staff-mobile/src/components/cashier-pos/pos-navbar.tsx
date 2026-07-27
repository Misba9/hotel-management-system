import React, { memo, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { staffAuth } from "../../lib/firebase";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
import { PosIcon } from "./pos-icons";
import { posColors, posGlass, posRadius, posShadow, posSpacing, posType } from "./pos-theme";

type Props = {
  restaurantName?: string;
  branchName?: string;
  cashierName?: string;
  counterNumber?: number;
  shiftActive?: boolean;
  unreadCount: number;
  onMenuToggle?: () => void;
  onHistory: () => void;
  onNotifications: () => void;
  onDelivery: () => void;
  onSettings: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onHelp: () => void;
};

const HEADER_ICON = 24;

export const PosNavbar = memo(function PosNavbar({
  restaurantName = "Nausheen Fruits Juice Center",
  branchName = "Main Branch",
  cashierName,
  counterNumber = 1,
  shiftActive = true,
  unreadCount,
  onMenuToggle,
  onHistory,
  onNotifications,
  onDelivery,
  onSettings,
  onProfile,
  onLogout,
  onHelp
}: Props) {
  const [now, setNow] = useState(new Date());
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const user = staffAuth?.currentUser;
  const displayCashier = cashierName ?? user?.displayName ?? user?.email?.split("@")[0] ?? "Cashier";
  const pad = layout.padding;
  const iconSize = layout.isTablet ? HEADER_ICON : layout.iconSize;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: Math.max(insets.top, posSpacing.sm),
          paddingHorizontal: pad,
          paddingBottom: layout.isTablet ? posSpacing.md : posSpacing.sm
        }
      ]}
    >
      <View style={[styles.row, layout.isTablet && styles.rowTablet]}>
        {/* Left — brand */}
        <View style={[styles.left, layout.isTablet && styles.leftTablet]}>
          {onMenuToggle ? (
            <Pressable
              onPress={onMenuToggle}
              style={[styles.iconBtn, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}
              accessibilityLabel="Toggle categories"
            >
              <Text style={styles.menuIcon}>☰</Text>
            </Pressable>
          ) : null}
          <View style={[styles.logo, layout.isTablet && styles.logoTablet]}>
            <Text style={[styles.logoText, layout.isTablet && styles.logoTextTablet]}>POS</Text>
          </View>
          <View style={styles.brandBlock}>
            <Text
              style={[
                styles.restaurant,
                layout.isTablet && styles.restaurantTablet,
                layout.isLargeTablet && styles.restaurantLarge
              ]}
              numberOfLines={1}
            >
              {layout.isPhone ? branchName : restaurantName}
            </Text>
            {layout.isTablet ? (
              <Text style={styles.branch} numberOfLines={1}>
                {branchName} · Counter {counterNumber}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Center — shift / cashier / time */}
        {layout.isTablet ? (
          <View style={styles.center}>
            <View style={[styles.shiftPill, !shiftActive && styles.shiftOff]}>
              <View style={[styles.shiftDot, !shiftActive && styles.shiftDotOff]} />
              <Text style={[styles.shiftText, !shiftActive && styles.shiftTextOff]}>
                {shiftActive ? "Shift Active" : "Shift Ended"}
              </Text>
            </View>
            <View style={styles.cashierRow}>
              <PosIcon name="user" size={16} color={posColors.textSecondary} />
              <Text style={styles.cashierName} numberOfLines={1}>
                {displayCashier}
              </Text>
            </View>
            <View style={styles.clockBox}>
              <PosIcon name="clock" size={18} color={posColors.primary} />
              <Text style={styles.clockTime}>{clock}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.phoneCenter}>
            <View style={[styles.shiftPill, !shiftActive && styles.shiftOff]}>
              <View style={[styles.shiftDot, !shiftActive && styles.shiftDotOff]} />
              <Text style={[styles.shiftText, !shiftActive && styles.shiftTextOff]}>
                {shiftActive ? "Active" : "Ended"}
              </Text>
            </View>
            <View style={styles.clockBoxCompact}>
              <Text style={styles.clockTimeCompact}>
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
        )}

        {/* Right — actions */}
        <View style={[styles.right, layout.isTablet && styles.rightTablet]}>
          <NavIconBtn icon="bell" badge={unreadCount} onPress={onNotifications} label="Notifications" size={iconSize} />
          {layout.isTablet ? (
            <>
              <NavIconBtn icon="history" onPress={onHistory} label="History" size={iconSize} />
              <NavIconBtn icon="help" onPress={onHelp} label="Shortcuts" size={iconSize} />
              <Pressable
                onPress={onDelivery}
                style={[styles.iconBtn, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}
                accessibilityLabel="Delivery hub"
              >
                <PosIcon name="parcel" size={iconSize} color={posColors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={onSettings}
                style={[styles.iconBtn, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}
                accessibilityLabel="Settings"
              >
                <Text style={styles.settingsIcon}>⚙</Text>
              </Pressable>
              <Pressable
                onPress={onProfile}
                style={[styles.iconBtn, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}
                accessibilityLabel="Profile"
              >
                <PosIcon name="user" size={iconSize} color={posColors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={onLogout}
                style={[styles.logoutBtn, { minHeight: layout.buttonHeight }]}
                accessibilityLabel="Logout"
              >
                <PosIcon name="logout" size={18} color={posColors.danger} />
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </>
          ) : (
            <>
              <NavIconBtn icon="history" onPress={onHistory} label="History" size={iconSize} />
              <Pressable
                onPress={onProfile}
                style={[styles.iconBtn, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}
                accessibilityLabel="Profile"
              >
                <PosIcon name="user" size={iconSize} color={posColors.textSecondary} />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
});

function NavIconBtn({
  icon,
  onPress,
  label,
  badge,
  size
}: {
  icon: "bell" | "history" | "user" | "help";
  onPress: () => void;
  label: string;
  badge?: number;
  size: number;
}) {
  const layout = useResponsiveLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        { minWidth: layout.minTouch, minHeight: layout.minTouch },
        pressed && styles.iconBtnPressed
      ]}
    >
      <PosIcon name={icon} size={size} color={posColors.textSecondary} />
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    ...posGlass(),
    borderBottomWidth: 1,
    borderBottomColor: posColors.borderStrong,
    ...posShadow(false),
    zIndex: 100,
    width: "100%"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: posSpacing.md,
    width: "100%"
  },
  rowTablet: { flexWrap: "nowrap", minHeight: 56 },
  left: { flexDirection: "row", alignItems: "center", gap: posSpacing.sm, flex: 1, minWidth: 0 },
  leftTablet: { flex: 1.1, gap: posSpacing.md },
  menuIcon: { color: posColors.text, fontSize: 18, fontWeight: "700" },
  logo: {
    width: 40,
    height: 40,
    borderRadius: posRadius.md,
    backgroundColor: posColors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...posShadow(false)
  },
  logoTablet: { width: 48, height: 48, borderRadius: 14 },
  logoText: { color: "#fff", fontWeight: "900", letterSpacing: 0.5, fontSize: 11 },
  logoTextTablet: { fontSize: 13 },
  brandBlock: { flex: 1, minWidth: 0 },
  restaurant: { ...posType.h3, fontSize: 15 },
  restaurantTablet: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4, color: posColors.text },
  restaurantLarge: { fontSize: 28, letterSpacing: -0.6 },
  branch: { fontSize: 14, fontWeight: "600", color: posColors.textSecondary, marginTop: 2 },
  center: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: posSpacing.lg,
    flexShrink: 1,
    minWidth: 0
  },
  phoneCenter: { flexDirection: "row", alignItems: "center", gap: posSpacing.sm, flexShrink: 0 },
  shiftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: posRadius.pill,
    backgroundColor: posColors.successMuted,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)"
  },
  shiftOff: { backgroundColor: posColors.dangerMuted, borderColor: "rgba(239,68,68,0.35)" },
  shiftDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: posColors.success },
  shiftDotOff: { backgroundColor: posColors.danger },
  shiftText: { fontSize: 13, fontWeight: "800", color: posColors.success },
  shiftTextOff: { color: posColors.danger },
  cashierRow: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 180 },
  cashierName: { fontSize: 15, fontWeight: "700", color: posColors.textSecondary },
  right: { flexDirection: "row", alignItems: "center", gap: posSpacing.xs, flexShrink: 0 },
  rightTablet: { flex: 1, justifyContent: "flex-end", gap: posSpacing.sm },
  clockBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: posRadius.md,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.borderStrong
  },
  clockBoxCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: posRadius.sm,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  clockTime: {
    fontSize: 16,
    fontWeight: "800",
    color: posColors.text,
    fontVariant: ["tabular-nums"]
  },
  clockTimeCompact: {
    fontSize: 13,
    fontWeight: "800",
    color: posColors.text,
    fontVariant: ["tabular-nums"]
  },
  iconBtn: {
    borderRadius: posRadius.md,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  iconBtnPressed: { opacity: 0.75, backgroundColor: posColors.cardHover },
  settingsIcon: { fontSize: 20, color: posColors.textSecondary },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: posColors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: posColors.dangerMuted
  },
  logoutText: { fontSize: 14, fontWeight: "800", color: posColors.danger }
});
