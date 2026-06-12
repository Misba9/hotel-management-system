import React, { useMemo } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import {
  DELIVERY_PARTNERS,
  filterOrdersByPartner,
  mapOrderToPartnerStatus,
  partnerIntegration,
  type DeliveryPartnerId
} from "../../lib/pos/delivery-partners";
import { getOrderSourceMeta } from "../../lib/pos/order-source";
import { PosButton } from "./pos-ui";
import { posCard, posColors, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  visible: boolean;
  orders: StaffOrderRow[];
  onClose: () => void;
  onPrint: (order: StaffOrderRow) => void;
};

export function PosDeliveryHub({ visible, orders, onClose, onPrint }: Props) {
  const [partner, setPartner] = React.useState<DeliveryPartnerId>("swiggy");
  const partnerOrders = useMemo(() => filterOrdersByPartner(orders, partner), [orders, partner]);
  const revenue = useMemo(
    () => partnerOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
    [partnerOrders]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[posCard(true), styles.sheet]}>
          <View style={styles.header}>
            <Text style={posType.h2}>Delivery Partners</Text>
            <Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable>
          </View>
          <ScrollView horizontal contentContainerStyle={styles.partners}>
            {DELIVERY_PARTNERS.map((p) => (
              <Pressable key={p.id} onPress={() => setPartner(p.id)} style={[styles.partnerChip, partner === p.id && { borderColor: p.color, backgroundColor: `${p.color}22` }]}>
                <Text style={styles.partnerLogo}>{p.logo}</Text>
                <Text style={styles.partnerName}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={posType.small}>Revenue ₹{revenue.toFixed(0)} · {partnerOrders.length} orders</Text>
          <ScrollView style={styles.list}>
            {partnerOrders.length === 0 ? (
              <Text style={posType.small}>No {partner} orders in queue</Text>
            ) : (
              partnerOrders.map((order) => {
                const st = mapOrderToPartnerStatus(order);
                const meta = getOrderSourceMeta(order);
                return (
                  <View key={order.id} style={[posCard(), styles.order]}>
                    <View style={styles.orderTop}>
                      <Text style={styles.orderId}>{meta.emoji} {order.id.slice(0, 8)}</Text>
                      <Text style={[styles.status, { color: posColors.primary }]}>{st}</Text>
                    </View>
                    <Text style={posType.small}>₹{order.totalAmount} · Token {order.tokenNumber ?? "—"}</Text>
                    <View style={styles.actions}>
                      <PosButton label="Accept" variant="primary" onPress={() => void partnerIntegration.acceptOrder(order.id, partner).then(() => Alert.alert("Accepted", "Partner sync queued."))} style={{ flex: 1, paddingVertical: 10 }} />
                      <PosButton label="Reject" variant="danger" onPress={() => void partnerIntegration.rejectOrder(order.id, partner).then(() => Alert.alert("Rejected", "Partner notified."))} style={{ flex: 1, paddingVertical: 10 }} />
                      <PosButton label="KOT" variant="secondary" onPress={() => { void partnerIntegration.printKitchenTicket(order.id); onPrint(order); }} style={{ flex: 1, paddingVertical: 10 }} />
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: { maxHeight: "85%", borderTopLeftRadius: posRadius.xl, borderTopRightRadius: posRadius.xl },
  header: { flexDirection: "row", justifyContent: "space-between", padding: posSpacing.lg, borderBottomWidth: 1, borderBottomColor: posColors.border },
  close: { fontSize: 20, color: posColors.textSecondary },
  partners: { padding: posSpacing.lg, gap: posSpacing.sm },
  partnerChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: posRadius.md, borderWidth: 1, borderColor: posColors.border, alignItems: "center", minWidth: 90 },
  partnerLogo: { fontSize: 18 },
  partnerName: { fontSize: 11, fontWeight: "800", color: posColors.text, marginTop: 4 },
  list: { padding: posSpacing.lg },
  order: { padding: posSpacing.md, marginBottom: posSpacing.sm },
  orderTop: { flexDirection: "row", justifyContent: "space-between" },
  orderId: { fontWeight: "800", color: posColors.text },
  status: { fontWeight: "800", fontSize: 11, textTransform: "uppercase" },
  actions: { flexDirection: "row", gap: 6, marginTop: posSpacing.sm }
});
