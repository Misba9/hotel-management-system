import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { StaffOrderRow } from "../services/orders";

export type KitchenTicketAction = "accept" | "ready";

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

type Props = {
  order: StaffOrderRow;
  busy: KitchenTicketAction | null;
  onAccept: () => Promise<void>;
  onMarkReady: () => Promise<void>;
};

export function KitchenTicketCard({ order, busy, onAccept, onMarkReady }: Props) {
  const canon = order.canonicalStatus ?? "pending";
  const raw = String(order.status ?? "");

  const { label, chipBg, chipText } = useMemo(() => {
    if (canon === "pending" || raw === "PLACED") {
      return { label: "New", chipBg: "#fee2e2", chipText: "#991b1b" };
    }
    return { label: "Preparing", chipBg: "#ffedd5", chipText: "#9a3412" };
  }, [canon, raw]);

  const showAccept = canon === "pending" || raw === "PLACED";
  const showReady = canon === "preparing" || raw === "PREPARING";

  const tableLabel =
    typeof order.tableNumber === "number" && Number.isFinite(order.tableNumber)
      ? order.tableNumber
      : "—";
  const tokenLabel =
    typeof order.tokenNumber === "number" && order.tokenNumber > 0 ? `#${order.tokenNumber}` : "—";

  const lines = order.items.map((it) => `${it.qty}× ${it.name}`);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.tableHuge}>Table {tableLabel}</Text>
        <View style={[styles.chip, { backgroundColor: chipBg }]}>
          <Text style={[styles.chipTxt, { color: chipText }]}>{label}</Text>
        </View>
      </View>
      <Text style={styles.token}>Token {tokenLabel}</Text>
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Items</Text>
      {lines.length === 0 ? (
        <Text style={styles.muted}>No line items</Text>
      ) : (
        lines.map((line, i) => (
          <Text key={i} style={styles.itemLine}>
            {line}
          </Text>
        ))
      )}
      <Text style={styles.total}>{formatMoney(order.totalAmount)}</Text>

      <View style={styles.actions}>
        {showAccept ? (
          <Pressable
            onPress={() => void onAccept()}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.btn,
              styles.btnAccept,
              busy !== null && styles.btnDisabled,
              pressed && busy === null && styles.pressed
            ]}
          >
            {busy === "accept" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Accept</Text>
            )}
          </Pressable>
        ) : null}
        {showReady ? (
          <Pressable
            onPress={() => void onMarkReady()}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.btn,
              styles.btnReady,
              busy !== null && styles.btnDisabled,
              pressed && busy === null && styles.pressed
            ]}
          >
            {busy === "ready" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Mark ready</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 22,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  tableHuge: {
    flex: 1,
    fontSize: 36,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.5
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999
  },
  chipTxt: { fontSize: 15, fontWeight: "800" },
  token: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: "800",
    color: "#2563eb"
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 16
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 8,
    letterSpacing: 0.4
  },
  itemLine: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
    lineHeight: 28
  },
  muted: { fontSize: 16, color: "#94a3b8" },
  total: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 22
  },
  btn: {
    minHeight: 52,
    minWidth: 160,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  btnAccept: { backgroundColor: "#ea580c" },
  btnReady: { backgroundColor: "#16a34a" },
  btnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.9 },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "800" }
});
