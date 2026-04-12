import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { shell, shellShadow } from "../../theme/shell-theme";

/**
 * @param {{ title: string, subtitle?: string, onSignOut?: () => void, badgeCount?: number }}
 */
export function ScreenTopBar({ title, subtitle, onSignOut, badgeCount }) {
  const raw = typeof badgeCount === "number" && badgeCount > 0 ? Math.floor(badgeCount) : 0;
  const showBadge = raw > 0;
  const badgeLabel = raw > 99 ? "99+" : String(raw);
  return (
    <View style={[styles.wrap, shellShadow(2)]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Text style={styles.title}>{title}</Text>
          {showBadge ? (
            <View style={styles.badge} accessibilityLabel={`${badgeLabel} pending`}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {onSignOut ? (
        <Pressable onPress={onSignOut} hitSlop={12}>
          <Text style={styles.out}>Sign out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: shell.surface,
    borderBottomWidth: 1,
    borderBottomColor: shell.border
  },
  title: { fontSize: 20, fontWeight: "900", color: shell.text, letterSpacing: -0.3 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "#E23744",
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  sub: { fontSize: 12, color: shell.muted, marginTop: 2 },
  out: { fontSize: 15, fontWeight: "700", color: shell.primary }
});
