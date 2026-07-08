import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { formatElapsed, formatKitchenTime, formatSource, isKitchenUrgent } from "../src/lib/kitchen-kds";
import { readyWaitIso, stageProgressIso } from "../src/lib/kitchen-order-mapper";
import type { KitchenOrder } from "../src/lib/kitchen-kds";

type BusyAction = "accept" | "preparing" | "ready" | "print" | "picked-up" | null;

type Props = {
  order: KitchenOrder;
  busy: BusyAction;
  onAccept: () => void;
  onPreparing: () => void;
  onPrint: () => void;
  onMarkReady: () => void;
  onPickedUp?: () => void;
  isNew?: boolean;
  showReadyActions?: boolean;
};

function useTick(intervalMs = 30000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export function KitchenTicketCard({
  order,
  busy,
  onAccept,
  onPreparing,
  onPrint,
  onMarkReady,
  onPickedUp,
  isNew = false,
  showReadyActions = false
}: Props) {
  useTick();
  const disabled = busy !== null;

  const timerLabel = useMemo(() => {
    if (order.status === "ready") {
      return `Waiting ${formatElapsed(readyWaitIso(order))}`;
    }
    if (order.status === "accepted" || order.status === "preparing") {
      return `In progress ${formatElapsed(stageProgressIso(order))}`;
    }
    return `${formatElapsed(order.createdAt)} ago`;
  }, [order]);

  const urgent = useMemo(() => {
    if (order.status === "ready") return isKitchenUrgent(readyWaitIso(order), 10);
    if (order.status === "new") return isKitchenUrgent(order.createdAt, 15);
    return isKitchenUrgent(stageProgressIso(order), 20);
  }, [order]);

  const canMarkPreparing = order.status === "accepted";
  const canMarkReady = order.status === "preparing";

  return (
    <View style={[styles.card, isNew && styles.cardNew, urgent && styles.cardUrgent]}>
      {order.status === "ready" ? (
        <View style={styles.readyHero}>
          <Text style={styles.readyBadge}>READY</Text>
          <Text style={styles.readyWait}>{timerLabel}</Text>
        </View>
      ) : null}

      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <View style={styles.metaRow}>
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>{formatSource(order.source)}</Text>
            </View>
            {order.tableNumber ? (
              <View style={[styles.chip, styles.chipTable]}>
                <Text style={styles.chipTxt}>Table {order.tableNumber}</Text>
              </View>
            ) : null}
            {order.status !== "ready" ? (
              <View style={[styles.chip, styles.chipTimer]}>
                <Text style={styles.chipTxt}>{timerLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {order.status !== "ready" ? (
          <View style={[styles.statusBadge, order.status === "new" && styles.statusNew]}>
            <Text style={styles.statusBadgeText}>
              {order.status === "new"
                ? "New"
                : order.status === "accepted"
                  ? "Accepted"
                  : "Preparing"}
            </Text>
          </View>
        ) : null}
      </View>

      {order.waiterName && showReadyActions ? (
        <Text style={styles.waiterLine}>Waiter: {order.waiterName}</Text>
      ) : null}

      <Text style={styles.timeMeta}>{formatKitchenTime(order.createdAt)}</Text>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Items</Text>
      {order.items.length === 0 ? (
        <Text style={styles.muted}>No line items</Text>
      ) : (
        order.items.map((it) => (
          <View key={`${order.orderId}-${it.productId}-${it.name}`} style={styles.itemBlock}>
            <Text style={styles.itemLine}>
              {it.quantity}× {it.name}
            </Text>
            {it.notes ? <Text style={styles.itemExtras}>{it.notes}</Text> : null}
          </View>
        ))
      )}

      {order.specialNotes?.trim() ? (
        <Text style={styles.orderNotes}>Note: {order.specialNotes.trim()}</Text>
      ) : null}

      <View style={styles.actions}>
        {order.status === "new" ? (
          <Pressable
            onPress={() => void onAccept()}
            disabled={disabled}
            style={({ pressed }) => [styles.btn, styles.btnAccept, disabled && styles.btnDisabled, pressed && styles.pressed]}
          >
            {busy === "accept" ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Accept</Text>}
          </Pressable>
        ) : null}

        {(order.status === "accepted" || order.status === "preparing") && !showReadyActions ? (
          <>
            <Pressable
              onPress={() => void onPreparing()}
              disabled={disabled || !canMarkPreparing}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrep,
                (disabled || !canMarkPreparing) && styles.btnDisabled,
                pressed && styles.pressed
              ]}
            >
              {busy === "preparing" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Preparing</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => void onMarkReady()}
              disabled={disabled || !canMarkReady}
              style={({ pressed }) => [
                styles.btn,
                styles.btnReady,
                (disabled || !canMarkReady) && styles.btnDisabled,
                pressed && styles.pressed
              ]}
            >
              {busy === "ready" ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Ready</Text>}
            </Pressable>
          </>
        ) : null}

        {!showReadyActions ? (
          <Pressable
            onPress={() => void onPrint()}
            disabled={disabled}
            style={({ pressed }) => [styles.btn, styles.btnPrint, disabled && styles.btnDisabled, pressed && styles.pressed]}
          >
            {busy === "print" ? <ActivityIndicator color="#f8fafc" /> : <Text style={styles.btnTextPrint}>Print</Text>}
          </Pressable>
        ) : null}

        {showReadyActions && order.status === "ready" && onPickedUp ? (
          <Pressable
            onPress={() => void onPickedUp()}
            disabled={disabled}
            style={({ pressed }) => [styles.btn, styles.btnPickedUp, disabled && styles.btnDisabled, pressed && styles.pressed]}
          >
            {busy === "picked-up" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Mark Picked Up</Text>
            )}
          </Pressable>
        ) : null}

        {showReadyActions ? (
          <Pressable
            onPress={() => void onPrint()}
            disabled={disabled}
            style={({ pressed }) => [styles.btn, styles.btnPrint, disabled && styles.btnDisabled, pressed && styles.pressed]}
          >
            {busy === "print" ? <ActivityIndicator color="#f8fafc" /> : <Text style={styles.btnTextPrint}>Print</Text>}
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
    marginBottom: 16,
    padding: 20,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  cardNew: { borderColor: "#f59e0b", shadowColor: "#f59e0b", shadowOpacity: 0.25 },
  cardUrgent: { borderColor: "#ef4444" },
  readyHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#dcfce7"
  },
  readyBadge: { fontSize: 22, fontWeight: "900", color: "#166534", letterSpacing: 1 },
  readyWait: { fontSize: 14, fontWeight: "700", color: "#15803d" },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerLeft: { flex: 1, minWidth: 0 },
  orderNumber: { fontSize: 28, fontWeight: "900", color: "#0f172a", letterSpacing: -0.5 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "#eef2ff" },
  chipTable: { backgroundColor: "#fef3c7" },
  chipTimer: { backgroundColor: "#e2e8f0" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#334155" },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#dbeafe"
  },
  statusNew: { backgroundColor: "#fef3c7" },
  statusBadgeText: { fontSize: 13, fontWeight: "800", color: "#1e40af" },
  waiterLine: { marginTop: 8, fontSize: 14, fontWeight: "600", color: "#475569" },
  timeMeta: { marginTop: 6, fontSize: 13, color: "#64748b", fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 14 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#64748b", marginBottom: 8, letterSpacing: 0.4 },
  itemBlock: { marginBottom: 8 },
  itemLine: { fontSize: 18, fontWeight: "600", color: "#1e293b", lineHeight: 26 },
  itemExtras: { fontSize: 13, color: "#64748b", marginTop: 2, fontStyle: "italic" },
  orderNotes: { marginTop: 8, fontSize: 14, color: "#b45309", fontWeight: "600" },
  muted: { fontSize: 15, color: "#94a3b8" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  btn: {
    minHeight: 46,
    minWidth: 100,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  btnAccept: { backgroundColor: "#2563eb" },
  btnPrep: { backgroundColor: "#ea580c" },
  btnPrint: { backgroundColor: "#475569" },
  btnReady: { backgroundColor: "#16a34a" },
  btnPickedUp: { backgroundColor: "#0f766e", flexGrow: 1 },
  btnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.9 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  btnTextPrint: { color: "#f8fafc", fontSize: 15, fontWeight: "800" }
});
