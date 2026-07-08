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
  const iconSize = layout.iconSize;
  const pad = layout.padding;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, posSpacing.xs), paddingHorizontal: pad }]}>
      <View style={[styles.row, layout.isTablet && styles.rowTablet]}>
        <View style={styles.left}>
          {onMenuToggle ? (
            <Pressable
              onPress={onMenuToggle}
              style={[styles.menuBtn, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}
              accessibilityLabel="Toggle menu"
            >
              <Text style={[styles.menuIcon, { fontSize: layout.moderateScale(16) }]}>☰</Text>
            </Pressable>
          ) : null}
          <View style={[styles.logo, { width: layout.scale(40), height: layout.scale(40) }]}>
            <Text style={[styles.logoText, { fontSize: layout.moderateScale(11) }]}>POS</Text>
          </View>
          <View style={styles.brandBlock}>
            <Text
              style={[styles.restaurant, { fontSize: layout.moderateScale(layout.isTablet ? 15 : 13) }]}
              numberOfLines={1}
            >
              {layout.isPhone ? branchName : restaurantName}
            </Text>
            {layout.isTablet ? (
              <Text style={[styles.branch, { fontSize: layout.moderateScale(11) }]}>{branchName}</Text>
            ) : null}
          </View>
        </View>

        {layout.isTablet ? (
          <View style={styles.center}>
            <View style={[styles.shiftPill, !shiftActive && styles.shiftOff]}>
              <View style={[styles.shiftDot, !shiftActive && styles.shiftDotOff]} />
              <Text style={[styles.shiftText, !shiftActive && styles.shiftTextOff]}>
                {shiftActive ? "Shift Active" : "Shift Ended"}
              </Text>
            </View>
            <View style={styles.cashierRow}>
              <PosIcon name="user" size={layout.moderateScale(12)} color={posColors.textSecondary} />
              <Text style={[styles.cashierName, { fontSize: layout.moderateScale(11) }]}>{displayCashier}</Text>
              <Text style={[styles.counter, { fontSize: layout.moderateScale(10) }]}>Counter {counterNumber}</Text>
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
          </View>
        )}

        <View style={styles.right}>
          <View style={styles.clockBox}>
            <PosIcon name="clock" size={layout.moderateScale(14)} color={posColors.primary} />
            <Text style={[styles.clockTime, { fontSize: layout.moderateScale(13) }]}>{clock}</Text>
          </View>

          <NavIconBtn icon="bell" badge={unreadCount} onPress={onNotifications} label="Notifications" size={iconSize} />
          {layout.isTablet ? (
            <>
              <NavIconBtn icon="history" onPress={onHistory} label="History" size={iconSize} />
              <NavIconBtn icon="help" onPress={onHelp} label="Shortcuts" size={iconSize} />
              <Pressable
                onPress={onSettings}
                style={[styles.iconBtn, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}
                accessibilityLabel="Settings"
              >
                <Text style={[styles.settingsIcon, { fontSize: layout.moderateScale(16) }]}>⚙</Text>
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
                style={[styles.logoutBtn, { minHeight: layout.minTouch }]}
                accessibilityLabel="Logout"
              >
                <PosIcon name="logout" size={layout.moderateScale(14)} color={posColors.danger} />
                <Text style={[styles.logoutText, { fontSize: layout.moderateScale(11) }]}>Logout</Text>
              </Pressable>
            </>
          ) : (
            <>
              <NavIconBtn icon="history" onPress={onHistory} label="History" size={iconSize} />
              <NavIconBtn icon="help" onPress={onHelp} label="Shortcuts" size={iconSize} />
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
    borderBottomColor: posColors.border,
    ...posShadow(false),
    zIndex: 100,
    paddingBottom: posSpacing.sm
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: posSpacing.sm,
    flexWrap: "wrap"
  },
  rowTablet: { flexWrap: "nowrap" },
  left: { flexDirection: "row", alignItems: "center", gap: posSpacing.sm, flex: 1, minWidth: 0 },
  menuBtn: {
    borderRadius: posRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  menuIcon: { color: posColors.text },
  logo: {
    borderRadius: posRadius.md,
    backgroundColor: posColors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...posShadow(false)
  },
  logoText: { color: "#fff", fontWeight: "900", letterSpacing: 0.5 },
  brandBlock: { flex: 1, minWidth: 0 },
  restaurant: { ...posType.h3 },
  branch: { ...posType.small, marginTop: 1 },
  center: { alignItems: "center", gap: 4, flexShrink: 0 },
  phoneCenter: { flexShrink: 0 },
  shiftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: posRadius.pill,
    backgroundColor: posColors.successMuted,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)"
  },
  shiftOff: { backgroundColor: posColors.dangerMuted, borderColor: "rgba(239,68,68,0.3)" },
  shiftDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: posColors.success },
  shiftDotOff: { backgroundColor: posColors.danger },
  shiftText: { fontSize: 10, fontWeight: "700", color: posColors.success },
  shiftTextOff: { color: posColors.danger },
  cashierRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cashierName: { fontWeight: "700", color: posColors.textSecondary },
  counter: { fontWeight: "600", color: posColors.textDim },
  right: { flexDirection: "row", alignItems: "center", gap: posSpacing.xs, flexShrink: 0 },
  clockBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: posRadius.sm,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  clockTime: { fontWeight: "800", color: posColors.text, fontVariant: ["tabular-nums"] },
  iconBtn: {
    borderRadius: posRadius.md,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  iconBtnPressed: { opacity: 0.7, backgroundColor: posColors.card },
  settingsIcon: {},
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: posColors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.dangerMuted,
    backgroundColor: posColors.dangerMuted
  },
  logoutText: { fontWeight: "800", color: posColors.danger }
});
