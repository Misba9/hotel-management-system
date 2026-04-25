import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DeliveryRow } from "../services/delivery";

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (s === "assigned") return { bg: "#fee2e2", fg: "#991b1b", label: "Assigned" };
  if (s === "picked") return { bg: "#ffedd5", fg: "#9a3412", label: "Picked" };
  if (s === "delivered") return { bg: "#dbeafe", fg: "#1e3a8a", label: "Delivered" };
  return { bg: "#f1f5f9", fg: "#0f172a", label: status || "Unknown" };
}

export type DeliveryCardProps = {
  row: DeliveryRow;
};

export function DeliveryCard({ row }: DeliveryCardProps) {
  const router = useRouter();
  const theme = statusStyle(row.status);

  return (
    <Pressable
      onPress={() => router.push(`/delivery/${row.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.title}>#{row.orderId ? row.orderId.slice(0, 8) : row.id.slice(0, 8)}</Text>
        <View style={[styles.chip, { backgroundColor: theme.bg }]}>
          <Text style={[styles.chipText, { color: theme.fg }]}>{theme.label}</Text>
        </View>
      </View>
      <Text style={styles.name}>{row.customerName}</Text>
      {row.mobile ? <Text style={styles.mobile}>{row.mobile}</Text> : null}
      <Text style={styles.addr}>{row.address}</Text>
      <Text style={styles.cta}>Open run →</Text>
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
  pressed: { opacity: 0.92 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "800", color: "#0f172a", flex: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: "700" },
  name: { marginTop: 8, fontSize: 15, fontWeight: "700", color: "#0f172a" },
  mobile: { marginTop: 4, fontSize: 14, fontWeight: "600", color: "#2563eb" },
  addr: { marginTop: 4, fontSize: 14, color: "#475569", lineHeight: 20 },
  cta: { marginTop: 12, fontSize: 14, fontWeight: "800", color: "#0f172a" }
});
