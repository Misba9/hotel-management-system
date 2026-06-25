import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatKitchenStatusLabel } from "@shared/utils/order-display";
import { formatItemExtras } from "@shared/lib/format-item-extras";

import type { StaffOrderRow } from "../services/orders";
import { getOrderSourceMeta } from "../src/lib/pos/order-source";

type Props = {
  order: StaffOrderRow;
  busy: "accept" | "preparing" | "ready" | "print" | null;
  onAccept: () => void;
  onPreparing: () => void;
  onPrint: () => void;
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
  onAccept,
  onPreparing,
  onPrint,
  onMarkReady,
  isNew = false
}: Props) {
  const canon = order.canonicalStatus ?? "new";
  const statusLabel = formatKitchenStatusLabel(canon);
  const sourceMeta = getOrderSourceMeta(order);

  const tableLabel =
    typeof order.tableName === "string" && order.tableName.trim()
      ? order.tableName.trim()
      : typeof order.tableNumber === "number" && Number.isFinite(order.tableNumber)
        ? `Table ${order.tableNumber}`
        : "—";

  const tokenLabel =
    typeof order.tokenNumber === "number" && order.tokenNumber > 0
      ? `#${order.tokenNumber}`
      : `#${order.id.slice(-6).toUpperCase()}`;

  const timeLabel = useMemo(() => formatTicketTime(order), [order]);
  const disabled = busy !== null;

  return (
    <View style={[styles.card, isNew && styles.cardNew]}>
      <View style={styles.topRow}>
        <Text style={styles.tableHuge}>{tableLabel}</Text>
        <View style={[styles.chip, styles.chipStatus]}>
          <Text style={styles.chipTxt}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {tokenLabel} · {timeLabel}
      </Text>
      <View style={styles.sourceBadge}>
        <Text style={styles.sourceBadgeText}>
          {sourceMeta.emoji} {sourceMeta.label}
        </Text>
      </View>
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Items</Text>
      {order.items.length === 0 ? (
        <Text style={styles.muted}>No line items</Text>
      ) : (
        order.items.map((it, i) => {
          const row = it as { name: string; qty: number; modifications?: string[]; note?: string };
          const extras = formatItemExtras({
            modifications: row.modifications,
            note: row.note
          });
          return (
            <View key={`${order.id}-item-${i}`} style={styles.itemBlock}>
              <Text style={styles.itemLine}>
                {row.qty}× {row.name}
              </Text>
              {extras ? <Text style={styles.itemExtras}>{extras}</Text> : null}
            </View>
          );
        })
      )}
      {order.notes?.trim() ? (
        <Text style={styles.orderNotes}>Note: {order.notes.trim()}</Text>
      ) : null}
      <View style={styles.actions}>
        {canon === "new" ? (
          <Pressable
            onPress={() => void onAccept()}
            disabled={disabled}
            style={({ pressed }) => [styles.btn, styles.btnAccept, disabled && styles.btnDisabled, pressed && styles.pressed]}
          >
            {busy === "accept" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Accept</Text>
            )}
          </Pressable>
        ) : null}
        {canon === "accepted" ? (
          <Pressable
            onPress={() => void onPreparing()}
            disabled={disabled}
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrep,
              disabled && styles.btnDisabled,
              pressed && styles.pressed
            ]}
          >
            {busy === "preparing" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Preparing</Text>
            )}
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void onPrint()}
          disabled={disabled}
          style={({ pressed }) => [styles.btn, styles.btnPrint, disabled && styles.btnDisabled, pressed && styles.pressed]}
        >
          {busy === "print" ? (
            <ActivityIndicator color="#f8fafc" />
          ) : (
            <Text style={styles.btnTextPrint}>Print</Text>
          )}
        </Pressable>
        {canon === "preparing" ? (
          <Pressable
            onPress={() => void onMarkReady()}
            disabled={disabled}
            style={({ pressed }) => [styles.btn, styles.btnReady, disabled && styles.btnDisabled, pressed && styles.pressed]}
          >
            {busy === "ready" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Ready</Text>
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
  cardNew: { borderColor: "#f59e0b", shadowColor: "#f59e0b", shadowOpacity: 0.3 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  tableHuge: { flex: 1, fontSize: 36, fontWeight: "900", color: "#0f172a", letterSpacing: -0.5 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#e2e8f0" },
  chipStatus: { backgroundColor: "#dbeafe" },
  chipTxt: { fontSize: 15, fontWeight: "800", color: "#1e40af" },
  meta: { marginTop: 10, fontSize: 15, fontWeight: "700", color: "#334155" },
  sourceBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#eef2ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  sourceBadgeText: { fontSize: 12, fontWeight: "800", color: "#3730a3" },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#64748b", marginBottom: 8, letterSpacing: 0.4 },
  itemBlock: { marginBottom: 10 },
  itemLine: { fontSize: 20, fontWeight: "600", color: "#1e293b", lineHeight: 28 },
  itemExtras: { fontSize: 14, color: "#64748b", marginTop: 2, fontStyle: "italic" },
  orderNotes: { marginTop: 8, fontSize: 14, color: "#b45309", fontWeight: "600" },
  muted: { fontSize: 16, color: "#94a3b8" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 },
  btn: { minHeight: 48, minWidth: 100, paddingHorizontal: 16, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnAccept: { backgroundColor: "#2563eb" },
  btnPrep: { backgroundColor: "#ea580c" },
  btnPrint: { backgroundColor: "#475569" },
  btnReady: { backgroundColor: "#16a34a" },
  btnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.9 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  btnTextPrint: { color: "#f8fafc", fontSize: 16, fontWeight: "800" }
});
