import React from "react";
import { Alert, Linking, Text, TouchableOpacity, View } from "react-native";
import { staffColors } from "../../theme/staff-ui";
import type { DeliveryOrderView } from "./delivery-types";

function shortOrderId(id: string): string {
  if (id.length <= 12) return id;
  return id.slice(-8);
}

function statusPresentation(status: string): { label: string; bg: string; fg: string } {
  const s = status.toLowerCase().replace(/_/g, " ");
  const raw = status.toLowerCase();
  if (raw === "ready") return { label: "Ready", bg: "#FEF3C7", fg: "#92400E" };
  if (raw === "out_for_delivery") return { label: "Out for delivery", bg: "#DBEAFE", fg: "#1E40AF" };
  if (raw === "delivered") return { label: "Delivered", bg: "#DCFCE7", fg: "#166534" };
  if (raw === "preparing" || raw === "accepted") return { label: s, bg: "#FFEDD5", fg: "#9A3412" };
  return { label: s, bg: "#f1f5f9", fg: "#334155" };
}

type Props = {
  order: DeliveryOrderView;
  busy: boolean;
  showActions: boolean;
  onPickOrder: () => void;
  onMarkDelivered: () => void;
};

export function DeliveryOrderCard({ order, busy, showActions, onPickOrder, onMarkDelivered }: Props) {
  const s = order.status.toLowerCase();
  const isReady = s === "ready";
  const isOut = s === "out_for_delivery";
  const waiting = ["pending", "created", "confirmed", "preparing", "accepted"].includes(s) && !isReady && !isOut;
  const badge = statusPresentation(order.status);

  const openMaps = () => {
    const dest = order.deliveryAddress?.trim();
    if (!dest) {
      Alert.alert("No address", "This order has no delivery address.");
      return;
    }
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`
    );
  };

  const callCustomer = () => {
    const p = (order.phone ?? "").trim();
    if (!p) {
      Alert.alert("No phone", "No phone number on this order.");
      return;
    }
    void Linking.openURL(`tel:${p}`);
  };

  return (
    <View
      style={{
        borderRadius: 18,
        backgroundColor: staffColors.surface,
        borderWidth: 1,
        borderColor: staffColors.border,
        padding: 16,
        marginBottom: 14,
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
        elevation: 4
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: staffColors.text }}>
            📦 Order #{shortOrderId(order.id)}
          </Text>
          {order.customerName?.trim() ? (
            <Text style={{ marginTop: 4, fontSize: 14, fontWeight: "700", color: "#334155" }} numberOfLines={1}>
              {order.customerName.trim()}
            </Text>
          ) : null}
        </View>
        <View style={{ borderRadius: 999, backgroundColor: badge.bg, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontWeight: "800", fontSize: 11, color: badge.fg }} numberOfLines={2}>
            {badge.label}
          </Text>
        </View>
      </View>

      <Text style={{ marginTop: 12, fontSize: 13, fontWeight: "700", color: "#64748b" }}>Address</Text>
      <Text style={{ marginTop: 4, fontSize: 15, color: staffColors.text, lineHeight: 22 }}>
        {order.deliveryAddress?.trim() || "—"}
      </Text>

      {order.orderType ? (
        <Text style={{ marginTop: 8, fontSize: 12, color: staffColors.muted }}>Type: {order.orderType}</Text>
      ) : null}

      {typeof order.totalAmount === "number" ? (
        <Text style={{ marginTop: 10, fontWeight: "900", fontSize: 17, color: staffColors.accent }}>₹{order.totalAmount}</Text>
      ) : null}

      {showActions && waiting ? (
        <Text style={{ marginTop: 12, fontSize: 12, color: staffColors.muted, fontStyle: "italic" }}>
          Waiting for kitchen — Pick Order unlocks when status is Ready.
        </Text>
      ) : null}

      {showActions ? (
        <>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              onPress={callCustomer}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 11,
                borderRadius: 12,
                backgroundColor: "#f1f5f9",
                borderWidth: 1,
                borderColor: staffColors.border
              }}
            >
              <Text style={{ fontSize: 16 }}>📞</Text>
              <Text style={{ fontWeight: "800", fontSize: 13, color: staffColors.text }}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openMaps}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 11,
                borderRadius: 12,
                backgroundColor: "#F5F3FF",
                borderWidth: 1,
                borderColor: "#DDD6FE"
              }}
            >
              <Text style={{ fontSize: 16 }}>🧭</Text>
              <Text style={{ fontWeight: "800", fontSize: 13, color: "#5B21B6" }}>Navigate</Text>
            </TouchableOpacity>
          </View>

          {isReady ? (
            <TouchableOpacity
              onPress={onPickOrder}
              disabled={busy}
              style={{
                marginTop: 12,
                borderRadius: 14,
                backgroundColor: busy ? "#cbd5e1" : "#0EA5E9",
                paddingVertical: 14,
                alignItems: "center"
              }}
            >
              <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{busy ? "…" : "Pick order"}</Text>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, marginTop: 2 }}>Starts out-for-delivery</Text>
            </TouchableOpacity>
          ) : null}

          {isOut ? (
            <TouchableOpacity
              onPress={onMarkDelivered}
              disabled={busy}
              style={{
                marginTop: 12,
                borderRadius: 14,
                backgroundColor: busy ? "#cbd5e1" : staffColors.success,
                paddingVertical: 14,
                alignItems: "center"
              }}
            >
              <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{busy ? "…" : "Mark delivered"}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
