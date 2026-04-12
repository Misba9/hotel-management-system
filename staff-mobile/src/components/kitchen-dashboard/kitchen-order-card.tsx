import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { KitchenOrderRow } from "./kitchen-types";
import { bucketForStatus, displayStatusLabel, themeForBucket } from "./kitchen-status-theme";

type Props = {
  order: KitchenOrderRow;
  relativeTime: string;
  highlighted: boolean;
  busy: boolean;
  onStartPrep: () => void;
  onMarkReady: () => void;
  showStart: boolean;
  showReady: boolean;
};

function shortOrderId(id: string): string {
  if (id.length <= 10) return id;
  return id.slice(-8);
}

export function KitchenOrderCard({
  order,
  relativeTime,
  highlighted,
  busy,
  onStartPrep,
  onMarkReady,
  showStart,
  showReady
}: Props) {
  const bucket = bucketForStatus(order.status);
  const theme = themeForBucket(bucket);

  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: highlighted ? "#FFFBEB" : "#FFFFFF",
        padding: 14,
        borderWidth: highlighted ? 2 : 1,
        borderColor: highlighted ? "#FACC15" : theme.border,
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: highlighted ? 6 : 4 },
        shadowOpacity: highlighted ? 0.14 : 0.07,
        shadowRadius: highlighted ? 14 : 8,
        elevation: highlighted ? 6 : 3
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontWeight: "900", fontSize: 15, color: "#0f172a" }} numberOfLines={1}>
            Order #{shortOrderId(order.orderId)}
          </Text>
          {order.type ? (
            <Text style={{ marginTop: 2, fontSize: 11, color: "#64748b", fontWeight: "600" }} numberOfLines={1}>
              {order.type}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 999,
            backgroundColor: theme.badgeBg,
            paddingHorizontal: 10,
            paddingVertical: 5,
            maxWidth: "52%"
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.dot }} />
          <Text style={{ fontWeight: "900", fontSize: 11, color: theme.badgeFg }} numberOfLines={1}>
            {displayStatusLabel(order.status)}
          </Text>
        </View>
      </View>

      {highlighted ? (
        <Text style={{ marginTop: 8, fontSize: 11, fontWeight: "800", color: "#A16207" }}>NEW — just fired in</Text>
      ) : null}

      <View style={{ marginTop: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: theme.accentSoft }}>
        <Text style={{ fontWeight: "800", fontSize: 11, color: "#64748b", marginBottom: 6 }}>Items</Text>
        {order.items.length === 0 ? (
          <Text style={{ color: "#94a3b8", fontSize: 12 }}>Syncing lines…</Text>
        ) : (
          order.items.map((item, idx) => (
            <Text key={`${order.orderId}-it-${idx}`} style={{ color: "#334155", fontSize: 13, lineHeight: 20 }} numberOfLines={2}>
              • {item.name} <Text style={{ fontWeight: "800", color: "#0f172a" }}>×{item.qty}</Text>
            </Text>
          ))
        )}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <Text style={{ fontSize: 12, color: "#64748b", fontWeight: "600" }}>🕐 {relativeTime}</Text>
        {typeof order.totalAmount === "number" ? (
          <Text style={{ fontWeight: "900", fontSize: 14, color: theme.accent }}>₹{order.totalAmount}</Text>
        ) : null}
      </View>

      {(showStart || showReady) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {showStart ? (
            <TouchableOpacity
              onPress={onStartPrep}
              disabled={busy}
              style={{
                flexGrow: 1,
                minWidth: "42%",
                borderRadius: 12,
                backgroundColor: busy ? "#cbd5e1" : "#EA580C",
                paddingVertical: 11,
                alignItems: "center"
              }}
            >
              <Text style={{ color: "white", fontWeight: "900", fontSize: 13 }}>{busy ? "…" : "Accept"}</Text>
            </TouchableOpacity>
          ) : null}
          {showReady ? (
            <TouchableOpacity
              onPress={onMarkReady}
              disabled={busy}
              style={{
                flexGrow: 1,
                minWidth: "42%",
                borderRadius: 12,
                backgroundColor: busy ? "#cbd5e1" : "#16A34A",
                paddingVertical: 11,
                alignItems: "center"
              }}
            >
              <Text style={{ color: "white", fontWeight: "900", fontSize: 13 }}>{busy ? "…" : "Ready"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}
