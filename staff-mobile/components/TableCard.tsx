import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FloorTable } from "../services/tables";

export type TableCardProps = {
  table: FloorTable;
  /** Tap card (outside the status button) to start a new order for this table. */
  onOpenOrder?: () => void;
  onToggle?: (table: FloorTable, next: "FREE" | "OCCUPIED") => void;
  disabled?: boolean;
};

export function TableCard({ table, onOpenOrder, onToggle, disabled }: TableCardProps) {
  const busy = table.status === "occupied";
  const label =
    table.displayName?.trim() ||
    (Number.isFinite(table.number) && table.number > 0 ? `Table ${table.number}` : "Table");
  return (
    <Pressable
      onPress={onOpenOrder}
      disabled={!onOpenOrder}
      style={({ pressed }) => [styles.card, onOpenOrder && pressed && styles.cardPressed]}
    >
      <View style={styles.row}>
        <Text style={styles.title}>{label}</Text>
        <View style={[styles.badge, busy ? styles.badgeBusy : styles.badgeFree]}>
          <Text style={[styles.badgeText, busy ? styles.badgeTextBusy : styles.badgeTextFree]}>
            {busy ? "Occupied" : "Available"}
          </Text>
        </View>
      </View>
      {table.currentOrderId ? (
        <Text style={styles.meta}>Order: {table.currentOrderId.slice(0, 10)}…</Text>
      ) : (
        <Text style={styles.meta}>No active order linked</Text>
      )}
      {onToggle ? (
        <Pressable
          disabled={disabled}
          onPress={() => onToggle(table, busy ? "FREE" : "OCCUPIED")}
          style={({ pressed }) => [styles.btn, disabled && styles.btnDisabled, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>{busy ? "Mark free" : "Mark occupied"}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  cardPressed: { opacity: 0.92 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeFree: { backgroundColor: "#22c55e" },
  badgeBusy: { backgroundColor: "#ef4444" },
  badgeText: { fontWeight: "800", fontSize: 12 },
  badgeTextFree: { color: "#fff" },
  badgeTextBusy: { color: "#fff" },
  meta: { marginTop: 8, fontSize: 14, color: "#64748b" },
  btn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12
  },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnText: { color: "#fff", fontWeight: "700" }
});
