import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { staffAuth } from "../../lib/firebase";
import { PosIcon } from "./pos-icons";
import { posColors, posRadius, posShadow, posSpacing, posType } from "./pos-theme";

type Props = {
  restaurantName?: string;
  branchName?: string;
  unreadCount: number;
  onHistory: () => void;
  onNotifications: () => void;
  onMessages: () => void;
  onDelivery: () => void;
  onSettings: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onHelp: () => void;
};

export function PosNavbar({
  restaurantName = "Nausheen Fruits",
  branchName = "Main Branch",
  unreadCount,
  onHistory,
  onNotifications,
  onMessages,
  onDelivery,
  onSettings,
  onProfile,
  onLogout,
  onHelp
}: Props) {
  const [now, setNow] = useState(new Date());
  const user = staffAuth?.currentUser;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>N</Text>
        </View>
        <View>
          <Text style={posType.h3}>Cashier POS</Text>
          <Text style={posType.small}>{branchName} · Live sync</Text>
        </View>
      </View>

      <View style={styles.center}>
        <Text style={styles.restaurant}>{restaurantName}</Text>
        <View style={styles.shiftPill}>
          <View style={styles.shiftDot} />
          <Text style={styles.shiftText}>Shift Active</Text>
        </View>
      </View>

      <View style={styles.right}>
        <View style={styles.clockBox}>
          <PosIcon name="clock" size={14} color={posColors.textSecondary} />
          <View>
            <Text style={styles.clockTime}>{clock}</Text>
            <Text style={styles.clockDate}>{date}</Text>
          </View>
        </View>

        <NavIconBtn icon="bell" badge={unreadCount} onPress={onNotifications} label="Notifications" />
        <NavIconBtn icon="history" onPress={onHistory} label="History" />
        <NavIconBtn icon="user" onPress={onProfile} label="Profile" />
        <Pressable onPress={onLogout} style={styles.logoutBtn} accessibilityLabel="Logout">
          <PosIcon name="logout" size={16} color={posColors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
        {user?.email ? (
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
        ) : null}
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
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7, backgroundColor: posColors.card }]}
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
    paddingVertical: posSpacing.md,
    backgroundColor: posColors.secondary,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    ...posShadow(false),
    zIndex: 100,
    flexWrap: "wrap",
    gap: posSpacing.md
  },
  left: { flexDirection: "row", alignItems: "center", gap: posSpacing.md, minWidth: 160 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: posRadius.md,
    backgroundColor: posColors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...posShadow(false)
  },
  logoText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  center: { alignItems: "center", flex: 1, minWidth: 140 },
  restaurant: { ...posType.h3, fontSize: 18 },
  shiftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: posRadius.pill,
    backgroundColor: posColors.successMuted,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)"
  },
  shiftDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: posColors.success },
  shiftText: { fontSize: 11, fontWeight: "700", color: posColors.success },
  right: { flexDirection: "row", alignItems: "center", gap: posSpacing.sm, flexWrap: "wrap", justifyContent: "flex-end" },
  clockBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: posSpacing.sm },
  clockTime: { fontSize: 14, fontWeight: "800", color: posColors.text },
  clockDate: { fontSize: 10, color: posColors.textDim },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: posRadius.md,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
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
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.dangerMuted,
    backgroundColor: posColors.dangerMuted
  },
  logoutText: { fontSize: 12, fontWeight: "800", color: posColors.danger },
  email: { fontSize: 10, color: posColors.textDim, maxWidth: 120 },
  msgBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: posColors.border },
  msgText: { fontSize: 11, fontWeight: "800", color: posColors.textSecondary }
});
