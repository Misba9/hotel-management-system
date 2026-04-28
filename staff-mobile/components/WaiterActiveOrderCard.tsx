import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { StaffOrderRow } from "../services/orders";

function statusStyle(status: string): { bg: string; fg: string; label: string } {
  const s = status.toLowerCase();
  if (s === "pending") return { bg: "#fef3c7", fg: "#92400e", label: "Pending" };
  if (s === "preparing") return { bg: "#ffedd5", fg: "#9a3412", label: "Preparing" };
  if (s === "ready" || s === "done") return { bg: "#dcfce7", fg: "#166534", label: s === "done" ? "Done" : "Ready" };
  return { bg: "#e2e8f0", fg: "#334155", label: status || "—" };
}

export function WaiterActiveOrderCard({ order }: { order: StaffOrderRow }) {
  const table =
    order.tableName?.trim() ||
    (order.tableNumber != null ? `Table ${order.tableNumber}` : "Table");
  const st = statusStyle(String(order.status ?? ""));
  const lines = (order.items ?? []).slice(0, 6).map((it) => `${it.qty}× ${it.name}`);
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.table}>{table}</Text>
          <Text style={styles.token}>Token #{order.tokenNumber ?? "—"}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
        </View>
      </View>
      <Text style={styles.items} numberOfLines={4}>
        {lines.length ? lines.join(" · ") : "—"}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.total}>₹{Number(order.totalAmount ?? 0).toFixed(0)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  table: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  token: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#64748b" },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  items: { marginTop: 10, fontSize: 14, color: "#475569", lineHeight: 20 },
  footer: { marginTop: 12, flexDirection: "row", justifyContent: "flex-end" },
  total: { fontSize: 20, fontWeight: "900", color: "#0f172a" }
});
