import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { FirebaseError } from "firebase/app";
import { collection, onSnapshot, query, where, type DocumentData } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { staffDb, staffFunctions } from "../lib/firebase";
import { useStaffAuth } from "../context/staff-auth-context";
import { startDelivery } from "../services/orders.js";
import { staffColors } from "../theme/staff-ui";
import { DeliveryOrderCard, type DeliveryOrderView } from "./delivery-ui";

function parseOrderDoc(id: string, data: DocumentData): DeliveryOrderView {
  const status = String(data.status ?? "pending");
  const total =
    typeof data.totalAmount === "number"
      ? data.totalAmount
      : typeof data.total === "number"
        ? data.total
        : undefined;
  let createdAtMs = 0;
  const ca = data.createdAt;
  if (typeof ca === "string") createdAtMs = new Date(ca).getTime();
  else if (ca && typeof ca === "object" && "toDate" in ca) {
    try {
      createdAtMs = (ca as { toDate: () => Date }).toDate().getTime();
    } catch {
      createdAtMs = 0;
    }
  }
  return {
    id,
    status,
    totalAmount: total,
    customerName: typeof data.customerName === "string" ? data.customerName : null,
    phone: typeof data.phone === "string" ? data.phone : typeof data.customerPhone === "string" ? data.customerPhone : null,
    deliveryAddress:
      typeof data.deliveryAddress === "string"
        ? data.deliveryAddress
        : typeof data.address === "string"
          ? data.address
          : null,
    orderType: typeof data.orderType === "string" ? data.orderType : typeof data.type === "string" ? data.type : null,
    createdAtMs
  };
}

/**
 * Real-time assignments: `assignedTo.deliveryId` (canonical) plus legacy `deliveryPartnerId` / `deliveryBoyId`.
 * Status updates use `updateOrderStatusV1` (callable).
 */
export function DeliveryDashboardBoard() {
  const { width } = useWindowDimensions();
  const columns = width >= 720 ? 2 : 1;
  /** Screen uses horizontal padding 16; gap between cards in 2-col layout */
  const contentWidth = width - 32;
  const activeCardWidth = columns === 2 ? (contentWidth - 14) / 2 : contentWidth;
  const { user } = useStaffAuth();
  const uid = user?.uid ?? "";

  const readyMapRef = useRef(new Map<string, DeliveryOrderView>());
  const assignedMapRef = useRef(new Map<string, DeliveryOrderView>());
  const partnerMapRef = useRef(new Map<string, DeliveryOrderView>());
  const boyMapRef = useRef(new Map<string, DeliveryOrderView>());
  const [orders, setOrders] = useState<DeliveryOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenError, setListenError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const mergeAndSet = useCallback(() => {
    const merged = new Map<string, DeliveryOrderView>();
    readyMapRef.current.forEach((v, k) => merged.set(k, v));
    assignedMapRef.current.forEach((v, k) => merged.set(k, v));
    partnerMapRef.current.forEach((v, k) => merged.set(k, v));
    boyMapRef.current.forEach((v, k) => merged.set(k, v));
    const arr = Array.from(merged.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
    setOrders(arr);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!uid) {
      readyMapRef.current = new Map();
      assignedMapRef.current = new Map();
      partnerMapRef.current = new Map();
      boyMapRef.current = new Map();
      setOrders([]);
      setLoading(false);
      return;
    }

    setListenError(null);
    setLoading(true);
    readyMapRef.current = new Map();
    assignedMapRef.current = new Map();
    partnerMapRef.current = new Map();
    boyMapRef.current = new Map();

    const qReady = query(collection(staffDb, "orders"), where("status", "==", "ready"));
    const qAssigned = query(collection(staffDb, "orders"), where("assignedTo.deliveryId", "==", uid));
    const qPartner = query(collection(staffDb, "orders"), where("deliveryPartnerId", "==", uid));
    const qBoy = query(collection(staffDb, "orders"), where("deliveryBoyId", "==", uid));

    const unsubReady = onSnapshot(
      qReady,
      (snap) => {
        readyMapRef.current = new Map(snap.docs.map((d) => [d.id, parseOrderDoc(d.id, d.data())]));
        mergeAndSet();
      },
      (err) => {
        setListenError(err.message);
        setLoading(false);
      }
    );

    const unsubAssigned = onSnapshot(
      qAssigned,
      (snap) => {
        assignedMapRef.current = new Map(snap.docs.map((d) => [d.id, parseOrderDoc(d.id, d.data())]));
        mergeAndSet();
      },
      (err) => {
        setListenError(err.message);
        setLoading(false);
      }
    );

    const unsubPartner = onSnapshot(
      qPartner,
      (snap) => {
        partnerMapRef.current = new Map(snap.docs.map((d) => [d.id, parseOrderDoc(d.id, d.data())]));
        mergeAndSet();
      },
      (err) => {
        setListenError(err.message);
        setLoading(false);
      }
    );

    const unsubBoy = onSnapshot(
      qBoy,
      (snap) => {
        boyMapRef.current = new Map(snap.docs.map((d) => [d.id, parseOrderDoc(d.id, d.data())]));
        mergeAndSet();
      },
      (err) => {
        setListenError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubReady();
      unsubAssigned();
      unsubPartner();
      unsubBoy();
    };
  }, [uid, mergeAndSet]);

  const markDelivered = useCallback(async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      const callable = httpsCallable(staffFunctions, "updateOrderStatusV1");
      await callable({ orderId, status: "delivered" });
    } catch (e) {
      const msg =
        e instanceof FirebaseError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Update failed";
      Alert.alert("Could not update status", msg);
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const readyPool = useMemo(
    () => orders.filter((o) => o.status.toLowerCase() === "ready"),
    [orders]
  );

  const activeDeliveries = useMemo(
    () =>
      orders.filter((o) => {
        const s = o.status.toLowerCase();
        return s === "out_for_delivery";
      }),
    [orders]
  );

  const completedOrders = useMemo(() => orders.filter((o) => o.status.toLowerCase() === "delivered"), [orders]);

  const pickOrder = useCallback(
    async (orderId: string) => {
      if (!uid) return;
      setUpdatingId(orderId);
      try {
        await startDelivery(orderId, uid);
      } catch (e) {
        const msg =
          e instanceof FirebaseError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Could not claim order";
        Alert.alert("Could not start delivery", msg);
      } finally {
        setUpdatingId(null);
      }
    },
    [uid]
  );

  function renderCard(o: DeliveryOrderView, showActions: boolean) {
    const busy = updatingId === o.id;
    return (
      <View key={o.id} style={{ width: activeCardWidth }}>
        <DeliveryOrderCard
          order={o}
          busy={busy}
          showActions={showActions}
          onPickOrder={() => void pickOrder(o.id)}
          onMarkDelivered={() => void markDelivered(o.id)}
        />
      </View>
    );
  }

  if (!uid) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: staffColors.muted }}>Sign in to see assigned deliveries.</Text>
      </View>
    );
  }

  if (listenError) {
    return (
      <View style={{ borderRadius: 12, backgroundColor: "#FEF2F2", padding: 16, borderWidth: 1, borderColor: "#FECACA" }}>
        <Text style={{ color: "#991B1B", fontWeight: "700" }}>{listenError}</Text>
      </View>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <View style={{ borderRadius: 12, backgroundColor: staffColors.surface, padding: 24, alignItems: "center" }}>
        <ActivityIndicator color={staffColors.accent} />
        <Text style={{ marginTop: 10, color: staffColors.muted }}>Loading your assignments…</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={{ borderRadius: 16, backgroundColor: staffColors.surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: staffColors.border }}>
        <Text style={{ fontWeight: "900", fontSize: 20, color: staffColors.text }}>My deliveries</Text>
        <Text style={{ color: staffColors.muted, fontSize: 12, marginTop: 4 }}>
          Realtime sync with POS, kitchen, and admin. Ready pool → claim sets your deliveryId → out for delivery → delivered.
        </Text>
      </View>

      <Text style={{ fontWeight: "800", fontSize: 14, color: staffColors.text, marginBottom: 8 }}>Ready for pickup</Text>
      {readyPool.length === 0 ? (
        <View style={{ borderRadius: 12, backgroundColor: staffColors.surface, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: staffColors.border }}>
          <Text style={{ color: staffColors.muted, fontSize: 13 }}>No orders waiting at status “ready”.</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>{readyPool.map((o) => renderCard(o, true))}</View>
      )}

      <Text style={{ fontWeight: "800", fontSize: 14, color: staffColors.text, marginBottom: 8 }}>Out for delivery</Text>
      {activeDeliveries.length === 0 ? (
        <View style={{ borderRadius: 12, backgroundColor: staffColors.surface, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: staffColors.border }}>
          <Text style={{ color: staffColors.muted, fontSize: 13 }}>No active runs. Claim a ready order above to assign yourself.</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>{activeDeliveries.map((o) => renderCard(o, true))}</View>
      )}

      <Text style={{ fontWeight: "800", fontSize: 14, color: staffColors.text, marginBottom: 8 }}>Completed</Text>
      {completedOrders.length === 0 ? (
        <Text style={{ color: staffColors.muted, fontSize: 13, marginBottom: 8 }}>No completed deliveries in this session snapshot.</Text>
      ) : (
        <ScrollView style={{ maxHeight: 280 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{completedOrders.map((o) => renderCard(o, false))}</View>
        </ScrollView>
      )}
    </View>
  );
}
