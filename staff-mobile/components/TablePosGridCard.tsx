import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FloorTable } from "../services/tables";

export type TablePosGridCardProps = {
  table: FloorTable;
  activeOrderCount: number;
  onTakeOrder: () => void;
  width: number;
};

export function TablePosGridCard({ table, activeOrderCount, onTakeOrder, width }: TablePosGridCardProps) {
  const busy = table.status === "occupied";
  const label =
    table.displayName?.trim() ||
    (Number.isFinite(table.number) && table.number > 0 ? `Table ${table.number}` : "Table");
  return (
    <Pressable
      onPress={onTakeOrder}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <Text style={styles.title} numberOfLines={2}>
        {label}
      </Text>
      <View style={[styles.badge, busy ? styles.badgeBusy : styles.badgeFree]}>
        <Text style={styles.badgeText}>{busy ? "Occupied" : "Available"}</Text>
      </View>
      <View style={styles.countRow}>
        <Text style={styles.countLabel}>Active orders</Text>
        <Text style={styles.countVal}>{activeOrderCount}</Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>Take order</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  title: { fontSize: 17, fontWeight: "900", color: "#0f172a", minHeight: 44 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  badgeFree: { backgroundColor: "#22c55e" },
  badgeBusy: { backgroundColor: "#ef4444" },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  countRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9"
  },
  countLabel: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  countVal: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  cta: {
    marginTop: 12,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 14 }
});
