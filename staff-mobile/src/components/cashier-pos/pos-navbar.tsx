import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { staffAuth } from "../../lib/firebase";
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

export function PosNavbar({
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
  const user = staffAuth?.currentUser;
  const displayCashier = cashierName ?? user?.displayName ?? user?.email?.split("@")[0] ?? "Cashier";

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {onMenuToggle ? (
          <Pressable onPress={onMenuToggle} style={styles.menuBtn} accessibilityLabel="Toggle menu">
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
        ) : null}
        <View style={styles.logo}>
          <Text style={styles.logoText}>POS</Text>
        </View>
        <View style={styles.brandBlock}>
          <Text style={styles.restaurant} numberOfLines={1}>
            {restaurantName}
          </Text>
          <Text style={styles.branch}>{branchName}</Text>
        </View>
      </View>

      <View style={styles.center}>
        <View style={[styles.shiftPill, !shiftActive && styles.shiftOff]}>
          <View style={[styles.shiftDot, !shiftActive && styles.shiftDotOff]} />
          <Text style={[styles.shiftText, !shiftActive && styles.shiftTextOff]}>
            {shiftActive ? "Shift Active" : "Shift Ended"}
          </Text>
        </View>
        <View style={styles.cashierRow}>
          <PosIcon name="user" size={12} color={posColors.textSecondary} />
          <Text style={styles.cashierName}>{displayCashier}</Text>
          <Text style={styles.counter}>Counter {counterNumber}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <View style={styles.clockBox}>
          <PosIcon name="clock" size={14} color={posColors.primary} />
          <Text style={styles.clockTime}>{clock}</Text>
        </View>

        <NavIconBtn icon="bell" badge={unreadCount} onPress={onNotifications} label="Notifications" />
        <NavIconBtn icon="history" onPress={onHistory} label="History" />
        <NavIconBtn icon="help" onPress={onHelp} label="Shortcuts" />
        <Pressable onPress={onSettings} style={styles.settingsBtn} accessibilityLabel="Settings">
          <Text style={styles.settingsIcon}>⚙</Text>
        </Pressable>
        <Pressable onPress={onProfile} style={styles.iconBtn} accessibilityLabel="Profile">
          <PosIcon name="user" size={18} color={posColors.textSecondary} />
        </Pressable>
        <Pressable onPress={onLogout} style={styles.logoutBtn} accessibilityLabel="Logout">
          <PosIcon name="logout" size={14} color={posColors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavIconBtn({
  icon,
  onPress,
  label,
  badge
}: {
  icon: "bell" | "history" | "user" | "help";
  onPress: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
    >
      <PosIcon name={icon} size={18} color={posColors.textSecondary} />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: posSpacing.lg,
    paddingVertical: posSpacing.sm,
    ...posGlass(),
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    ...posShadow(false),
    zIndex: 100,
    flexWrap: "wrap",
    gap: posSpacing.sm,
    minHeight: 56
  },
  left: { flexDirection: "row", alignItems: "center", gap: posSpacing.sm, flex: 1, minWidth: 200 },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: posRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  menuIcon: { fontSize: 16, color: posColors.text },
  logo: {
    width: 40,
    height: 40,
    borderRadius: posRadius.md,
    backgroundColor: posColors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...posShadow(false)
  },
  logoText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  brandBlock: { flex: 1, minWidth: 0 },
  restaurant: { ...posType.h3, fontSize: 15 },
  branch: { ...posType.small, fontSize: 11, marginTop: 1 },
  center: { alignItems: "center", gap: 4, minWidth: 140 },
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
  cashierName: { fontSize: 11, fontWeight: "700", color: posColors.textSecondary },
  counter: { fontSize: 10, fontWeight: "600", color: posColors.textDim },
  right: { flexDirection: "row", alignItems: "center", gap: posSpacing.xs, flexWrap: "wrap", justifyContent: "flex-end" },
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
  clockTime: { fontSize: 13, fontWeight: "800", color: posColors.text, fontVariant: ["tabular-nums"] },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: posRadius.md,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  iconBtnPressed: { opacity: 0.7, backgroundColor: posColors.card },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: posRadius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  settingsIcon: { fontSize: 16 },
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
  logoutText: { fontSize: 11, fontWeight: "800", color: posColors.danger }
});
