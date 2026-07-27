import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type KitchenBadgeStatus = "new" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";

const BADGE_THEME: Record<
  KitchenBadgeStatus,
  { label: string; backgroundColor: string; color: string }
> = {
  new: { label: "New", backgroundColor: "#fef3c7", color: "#92400e" },
  accepted: { label: "Accepted", backgroundColor: "#dbeafe", color: "#1e40af" },
  preparing: { label: "Preparing", backgroundColor: "#ffedd5", color: "#c2410c" },
  ready: { label: "Ready", backgroundColor: "#dcfce7", color: "#166534" },
  completed: { label: "Completed", backgroundColor: "#e2e8f0", color: "#475569" },
  cancelled: { label: "Cancelled", backgroundColor: "#fee2e2", color: "#991b1b" }
};

type Props = {
  status: KitchenBadgeStatus;
};

export function KitchenStatusBadge({ status }: Props) {
  const theme = BADGE_THEME[status];
  return (
    <View style={[styles.badge, { backgroundColor: theme.backgroundColor }]}>
      <Text style={[styles.text, { color: theme.color }]}>{theme.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3
  }
});
