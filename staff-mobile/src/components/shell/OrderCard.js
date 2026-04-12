import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { shell, shellShadow } from "../../theme/shell-theme";
import { Button } from "./Button";

const STATUS_TINT = {
  pending: { bg: "#FFFBEB", border: "#FCD34D", label: "#B45309" },
  preparing: { bg: "#FFF7ED", border: "#FDBA74", label: "#C2410C" },
  ready: { bg: "#ECFDF5", border: "#6EE7B7", label: "#047857" },
  out_for_delivery: { bg: "#EFF6FF", border: "#93C5FD", label: "#1D4ED8" },
  delivered: { bg: "#F0FDFA", border: "#5EEAD4", label: "#0F766E" }
};

/**
 * Kitchen or delivery order surface — mock-friendly shapes.
 *
 * @param {{
 *   variant: 'kitchen' | 'delivery',
 *   orderId: string,
 *   items?: { name: string, qty: number }[],
 *   timeLabel?: string,
 *   status?: string,
 *   customerName?: string,
 *   address?: string,
 *   phone?: string,
 *   actions?: { title: string, onPress: () => void, variant?: 'primary' | 'secondary' }[]
 * }}
 */
export function OrderCard({
  variant,
  orderId,
  items = [],
  timeLabel,
  status = "pending",
  customerName,
  address,
  phone,
  actions = []
}) {
  const tint = STATUS_TINT[status] ?? STATUS_TINT.pending;

  return (
    <View style={[styles.card, shellShadow(4)]}>
      <View style={styles.header}>
        <Text style={styles.orderId}>#{orderId}</Text>
        {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
      </View>

      <View style={[styles.badge, { backgroundColor: tint.bg, borderColor: tint.border }]}>
        <Text style={[styles.badgeText, { color: tint.label }]}>{status.replace(/_/g, " ")}</Text>
      </View>

      {variant === "kitchen" && items.length > 0 ? (
        <View style={styles.items}>
          {items.map((line, i) => (
            <Text key={i} style={styles.itemLine}>
              {line.qty}× {line.name}
            </Text>
          ))}
        </View>
      ) : null}

      {variant === "delivery" ? (
        <View style={styles.deliveryMeta}>
          {customerName ? <Text style={styles.metaStrong}>{customerName}</Text> : null}
          {address ? <Text style={styles.meta}>{address}</Text> : null}
          {phone ? <Text style={styles.phone}>{phone}</Text> : null}
        </View>
      ) : null}

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a, i) => (
            <Button key={i} title={a.title} onPress={a.onPress} variant={a.variant ?? "primary"} style={styles.actionBtn} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.border,
    marginBottom: 14
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  orderId: { fontSize: 18, fontWeight: "900", color: shell.text, letterSpacing: -0.3 },
  time: { fontSize: 13, fontWeight: "600", color: shell.muted },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  },
  badgeText: { fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  items: { gap: 6 },
  itemLine: { fontSize: 15, color: shell.text, fontWeight: "600", lineHeight: 22 },
  deliveryMeta: { gap: 6, marginBottom: 4 },
  metaStrong: { fontSize: 16, fontWeight: "800", color: shell.text },
  meta: { fontSize: 14, color: shell.muted, lineHeight: 20 },
  phone: { fontSize: 14, fontWeight: "700", color: shell.primary },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, minWidth: 120, paddingVertical: 12 }
});
