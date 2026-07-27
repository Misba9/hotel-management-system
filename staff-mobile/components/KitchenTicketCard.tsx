import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import { KitchenStatusBadge } from "./Kitchen/KitchenStatusBadge";
import {
  formatKitchenTime,
  formatPreparingElapsed,
  formatReadyWaiting,
  formatSource,
  isKitchenUrgent,
  resolvePreparingStartedIso
} from "../src/lib/kitchen-kds";
import type { KitchenOrder } from "../src/lib/kitchen-kds";

type BusyAction = "accept" | "preparing" | "ready" | "print" | "picked-up" | null;

type Props = {
  order: KitchenOrder;
  busy: BusyAction;
  onAccept: () => void;
  onPrint: () => void;
  onMarkReady: () => void;
  onPickedUp?: () => void;
  isNew?: boolean;
  showReadyActions?: boolean;
};

function useTick(intervalMs = 15000): number {
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
  onPrint,
  onMarkReady,
  onPickedUp,
  isNew = false,
  showReadyActions = false
}: Props) {
  const tick = useTick();
  const appear = useRef(new Animated.Value(0)).current;
  const disabled = busy !== null;

  useEffect(() => {
    appear.setValue(0);
    Animated.spring(appear, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 90
    }).start();
  }, [appear, order.orderId, order.status]);

  const preparingIso = useMemo(() => resolvePreparingStartedIso(order), [order, tick]);

  const timerLabel = useMemo(() => {
    if (order.status === "ready") {
      const waitIso = order.readyAt;
      if (!waitIso) return null;
      return formatReadyWaiting(waitIso);
    }
    if (order.status === "preparing" && preparingIso) {
      return formatPreparingElapsed(preparingIso);
    }
    return null;
  }, [order, preparingIso, tick]);

  const urgent = useMemo(() => {
    if (order.status === "ready" && order.readyAt) return isKitchenUrgent(order.readyAt, 10);
    if (order.status === "new") return isKitchenUrgent(order.createdAt, 15);
    if (order.status === "preparing" && preparingIso) return isKitchenUrgent(preparingIso, 20);
    return false;
  }, [order, preparingIso, tick]);

  const badgeStatus =
    order.status === "new"
      ? "new"
      : order.status === "accepted"
        ? "accepted"
        : order.status === "preparing"
          ? "preparing"
          : "ready";

  const tableLabel = order.tableNumber
    ? order.source === "takeaway"
      ? `Table ${order.tableNumber}`
      : `Table ${order.tableNumber}`
    : order.source === "takeaway"
      ? "Parcel"
      : null;

  return (
    <Animated.View
      style={[
        styles.card,
        isNew && styles.cardNew,
        urgent && styles.cardUrgent,
        {
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0]
              })
            }
          ]
        }
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <KitchenStatusBadge status={badgeStatus} />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.chip}>
          <Text style={styles.chipTxt}>{formatSource(order.source)}</Text>
        </View>
        {tableLabel ? (
          <View style={[styles.chip, styles.chipTable]}>
            <Text style={styles.chipTxt}>{tableLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.timeMeta}>{formatKitchenTime(order.createdAt)}</Text>

      {timerLabel ? (
        <View style={[styles.timerChip, order.status === "ready" && styles.timerChipReady]}>
          <Text style={[styles.timerTxt, order.status === "ready" && styles.timerTxtReady]}>
            {timerLabel}
          </Text>
        </View>
      ) : null}

      {order.waiterName && showReadyActions ? (
        <Text style={styles.waiterLine}>Waiter: {order.waiterName}</Text>
      ) : null}

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Items</Text>
      {order.items.length === 0 ? (
        <Text style={styles.muted}>No line items</Text>
      ) : (
        order.items.map((it) => (
          <View key={`${order.orderId}-${it.productId}-${it.name}`} style={styles.itemBlock}>
            <Text style={styles.itemLine}>
              {it.quantity} × {it.name}
            </Text>
            {it.notes ? <Text style={styles.itemExtras}>+ {it.notes}</Text> : null}
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
            style={({ pressed }) => [
              styles.btn,
              styles.btnAccept,
              disabled && styles.btnDisabled,
              pressed && styles.pressed
            ]}
          >
            {busy === "accept" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Accept</Text>
            )}
          </Pressable>
        ) : null}

        {(order.status === "preparing" || order.status === "accepted") && !showReadyActions ? (
          <Pressable
            onPress={() => void onMarkReady()}
            disabled={disabled}
            style={({ pressed }) => [
              styles.btn,
              styles.btnReady,
              disabled && styles.btnDisabled,
              pressed && styles.pressed
            ]}
          >
            {busy === "ready" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Ready</Text>
            )}
          </Pressable>
        ) : null}

        {showReadyActions && order.status === "ready" && onPickedUp ? (
          <Pressable
            onPress={() => void onPickedUp()}
            disabled={disabled}
            style={({ pressed }) => [
              styles.btn,
              styles.btnPickedUp,
              disabled && styles.btnDisabled,
              pressed && styles.pressed
            ]}
          >
            {busy === "picked-up" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Mark Picked Up</Text>
            )}
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => void onPrint()}
          disabled={disabled}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrint,
            disabled && styles.btnDisabled,
            pressed && styles.pressed
          ]}
        >
          {busy === "print" ? (
            <ActivityIndicator color="#f8fafc" />
          ) : (
            <Text style={styles.btnTextPrint}>Print</Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    width: "100%",
    alignSelf: "stretch",
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  cardNew: { borderColor: "#f59e0b", shadowColor: "#f59e0b", shadowOpacity: 0.22 },
  cardUrgent: { borderColor: "#ef4444" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  orderNumber: {
    flexShrink: 1,
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.4
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#eef2ff"
  },
  chipTable: { backgroundColor: "#fef3c7" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#334155" },
  timeMeta: {
    marginTop: 8,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600"
  },
  timerChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ffedd5"
  },
  timerChipReady: { backgroundColor: "#dcfce7" },
  timerTxt: { fontSize: 12, fontWeight: "800", color: "#c2410c" },
  timerTxtReady: { color: "#166534" },
  waiterLine: { marginTop: 8, fontSize: 13, fontWeight: "600", color: "#475569" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#e2e8f0", marginVertical: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  itemBlock: { marginBottom: 6 },
  itemLine: { fontSize: 16, fontWeight: "600", color: "#1e293b", lineHeight: 22 },
  itemExtras: {
    fontSize: 13,
    color: "#c2410c",
    marginTop: 3,
    fontWeight: "700",
    lineHeight: 18
  },
  orderNotes: { marginTop: 6, fontSize: 13, color: "#b45309", fontWeight: "600" },
  muted: { fontSize: 14, color: "#94a3b8" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14
  },
  btn: {
    minHeight: 44,
    minWidth: 96,
    flexGrow: 1,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  btnAccept: { backgroundColor: "#2563eb" },
  btnPrint: { backgroundColor: "#475569" },
  btnReady: { backgroundColor: "#16a34a", flexGrow: 2 },
  btnPickedUp: { backgroundColor: "#0f766e", flexGrow: 2 },
  btnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  btnTextPrint: { color: "#f8fafc", fontSize: 14, fontWeight: "800" }
});
