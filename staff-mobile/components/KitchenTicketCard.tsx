import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { StaffOrderRow } from "../services/orders";

type Props = {
  order: StaffOrderRow;
  busy: "accept" | "ready" | "print" | null;
  onPrint: () => void;
  onAccept: () => void;
  onMarkReady: () => void;
  isNew?: boolean;
};

function formatTicketTime(order: StaffOrderRow) {
  const ms = order.createdAt?.toMillis?.();
  if (!ms) return "--:--";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function KitchenTicketCard({
  order,
  busy,
  onPrint,
  onAccept,
  onMarkReady,
  isNew = false
}: Props) {
  const canon = order.canonicalStatus ?? "pending";
  const raw = String(order.status ?? "");
  const rawLower = raw.toLowerCase();
  const isPending = canon === "pending" || raw === "PLACED";
  const isPreparing = canon === "preparing" || rawLower === "preparing" || raw === "PREPARING";
  const statusLabel = isPreparing ? "Preparing" : isPending ? "New" : "Unknown";
  const showAccept = isPending;
  const showReady = isPreparing;

  const tableLabel =
    typeof order.tableNumber === "number" && Number.isFinite(order.tableNumber)
      ? order.tableNumber
      : "—";

  const lines = order.items.map((it) => `${it.qty}× ${it.name}`);
  const timeLabel = useMemo(() => formatTicketTime(order), [order]);

  const disabled = busy !== null;

  return (
    <View style={[styles.card, isNew && styles.cardNew]}>
      <View style={styles.topRow}>
        <Text style={styles.tableHuge}>Table {tableLabel}</Text>
        <View style={[styles.chip, isPending && styles.chipNew, isPreparing && styles.chipPrep]}>
          <Text style={[styles.chipTxt, isPending && styles.chipTxtNew, isPreparing && styles.chipTxtPrep]}>
            {statusLabel}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>Time {timeLabel}</Text>
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
      <View style={styles.actions}>
        <Pressable
          onPress={() => void onPrint()}
          disabled={disabled}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrint,
            disabled && styles.btnDisabled,
            pressed && !disabled && styles.pressed
          ]}
        >
          {busy === "print" ? (
            <ActivityIndicator color="#f8fafc" />
          ) : (
            <Text style={styles.btnTextPrint}>Print</Text>
          )}
        </Pressable>
        {showAccept ? (
          <Pressable
            onPress={() => void onAccept()}
            disabled={disabled}
            style={({ pressed }) => [
              styles.btn,
              styles.btnAccept,
              disabled && styles.btnDisabled,
              pressed && !disabled && styles.pressed
            ]}
          >
            {busy === "accept" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Start Preparing</Text>
            )}
          </Pressable>
        ) : null}
        {showReady ? (
          <Pressable
            onPress={() => void onMarkReady()}
            disabled={disabled}
            style={({ pressed }) => [
              styles.btn,
              styles.btnReady,
              disabled && styles.btnDisabled,
              pressed && !disabled && styles.pressed
            ]}
          >
            {busy === "ready" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Mark Ready</Text>
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
  cardNew: {
    borderColor: "#f59e0b",
    shadowColor: "#f59e0b",
    shadowOpacity: 0.3
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
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#e2e8f0" },
  chipNew: { backgroundColor: "#fee2e2" },
  chipPrep: { backgroundColor: "#ffedd5" },
  chipTxt: { fontSize: 15, fontWeight: "800", color: "#475569" },
  chipTxtNew: { color: "#991b1b" },
  chipTxtPrep: { color: "#9a3412" },
  meta: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
    color: "#334155"
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
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22
  },
  btn: {
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  btnPrint: { backgroundColor: "#475569" },
  btnAccept: { backgroundColor: "#ea580c" },
  btnReady: { backgroundColor: "#16a34a" },
  btnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.9 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  btnTextPrint: { color: "#f8fafc", fontSize: 16, fontWeight: "800" }
});
