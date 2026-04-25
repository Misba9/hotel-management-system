import React, { useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { StaffRoleId } from "../src/constants/staff-roles";
import {
  applyOrderRowAction,
  kitchenMarkOrderReady,
  type StaffOrderRow,
  waiterAcceptOrder,
  waiterMarkServed
} from "../services/orders";

export type OrderCardAction = "accept" | "ready" | "served";

function statusTheme(canonical: string, raw: string) {
  const c = canonical.toLowerCase();
  if (c === "pending") {
    return { chip: "#fee2e2", chipText: "#991b1b", label: "Pending" };
  }
  if (c === "preparing") {
    return { chip: "#ffedd5", chipText: "#9a3412", label: "Preparing" };
  }
  if (c === "ready") {
    return { chip: "#dcfce7", chipText: "#166534", label: "Ready" };
  }
  if (c === "served") {
    return { chip: "#e2e8f0", chipText: "#475569", label: "Served" };
  }
  const s = raw.toUpperCase();
  if (s === "DELIVERED") {
    return { chip: "#dbeafe", chipText: "#1e3a8a", label: "Delivered" };
  }
  if (s === "OUT_FOR_DELIVERY") {
    return { chip: "#e0f2fe", chipText: "#0369a1", label: "Out for delivery" };
  }
  return { chip: "#f1f5f9", chipText: "#0f172a", label: raw || "Unknown" };
}

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

export type OrderCardProps = {
  order: StaffOrderRow;
  role: StaffRoleId;
  busyAction: OrderCardAction | null;
  onBusy: (action: OrderCardAction | null) => void;
  onUpdated?: () => void;
  /** Waiter/kitchen pipeline (pending → preparing → ready → served). */
  restaurantFlow?: boolean;
};

export function OrderCard({
  order,
  role,
  busyAction,
  onBusy,
  onUpdated,
  restaurantFlow = false
}: OrderCardProps) {
  const canon = order.canonicalStatus ?? "pending";
  const theme = useMemo(
    () => statusTheme(canon, String(order.status ?? "")),
    [canon, order.status]
  );

  const actions = useMemo((): OrderCardAction[] => {
    if (restaurantFlow) {
      if (role === "waiter") {
        const out: OrderCardAction[] = [];
        if (canon === "pending") out.push("accept");
        if (canon === "ready") out.push("served");
        return out;
      }
      if (role === "kitchen") {
        return canon === "preparing" ? ["ready"] : [];
      }
    }

    const st = String(order.status ?? "");
    const isTable = order.orderType === "table";
    const isPrivileged = role === "admin" || role === "manager";

    if (isTable) {
      if (st === "PLACED" && (role === "kitchen" || isPrivileged)) return ["accept"];
      if (st === "PREPARING" && (role === "kitchen" || isPrivileged)) return ["ready"];
      if (st === "READY" && (role === "waiter" || isPrivileged)) return ["served"];
      return [];
    }

    const cur = st.toLowerCase();
    if (role === "kitchen" || isPrivileged) {
      if (cur === "pending" || cur === "created" || cur === "confirmed") return ["accept"];
      if (cur === "accepted") return ["accept"];
      if (cur === "preparing") return ["ready"];
    }
    if (role === "waiter" || isPrivileged) {
      if (cur === "ready") return ["served"];
      if (cur === "out_for_delivery") return ["served"];
    }
    return [];
  }, [canon, order.orderType, order.status, restaurantFlow, role]);

  const lines = order.items
    .map((it) => `${it.qty}× ${it.name}`)
    .slice(0, 4)
    .join("\n");

  const runRestaurant = async (action: OrderCardAction) => {
    onBusy(action);
    try {
      if (role === "waiter") {
        if (action === "accept") await waiterAcceptOrder(order);
        if (action === "served") await waiterMarkServed(order);
      } else if (role === "kitchen" && action === "ready") {
        await kitchenMarkOrderReady(order);
      }
      onUpdated?.();
    } catch (e) {
      Alert.alert("Update failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      onBusy(null);
    }
  };

  const runLegacy = async (action: OrderCardAction) => {
    onBusy(action);
    try {
      await applyOrderRowAction(order, action, role);
      onUpdated?.();
    } catch (e) {
      Alert.alert("Update failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      onBusy(null);
    }
  };

  const run = restaurantFlow && (role === "waiter" || role === "kitchen") ? runRestaurant : runLegacy;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Order #{order.id.slice(0, 8)}</Text>
        <View style={[styles.chip, { backgroundColor: theme.chip }]}>
          <Text style={[styles.chipText, { color: theme.chipText }]}>{theme.label}</Text>
        </View>
      </View>
      {typeof order.tableNumber === "number" ? (
        <Text style={styles.meta}>Table {order.tableNumber}</Text>
      ) : null}
      {typeof order.tokenNumber === "number" ? (
        <Text style={styles.meta}>Token #{order.tokenNumber}</Text>
      ) : null}
      <Text style={styles.meta}>{lines || "No line items"}</Text>
      <Text style={styles.total}>{formatMoney(order.totalAmount)}</Text>

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a) => {
            const label = a === "accept" ? "Accept" : a === "ready" ? "Mark ready" : "Served";
            const busy = busyAction === a;
            return (
              <Pressable
                key={a}
                onPress={() => void run(a)}
                disabled={busyAction !== null}
                style={({ pressed }) => [
                  styles.btn,
                  a === "accept" && styles.btnAccept,
                  a === "ready" && styles.btnReady,
                  a === "served" && styles.btnServed,
                  (pressed || busy) && styles.btnPressed
                ]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{label}</Text>}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
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
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: "#0f172a", flex: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: "700" },
  meta: { marginTop: 8, fontSize: 14, color: "#475569", lineHeight: 20 },
  total: { marginTop: 10, fontSize: 18, fontWeight: "800", color: "#0f172a" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  btn: {
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  btnAccept: { backgroundColor: "#ea580c" },
  btnReady: { backgroundColor: "#16a34a" },
  btnServed: { backgroundColor: "#64748b" },
  btnPressed: { opacity: 0.85 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 }
});
