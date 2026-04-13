import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { FirebaseError } from "firebase/app";
import { onSnapshot, type DocumentData, type QuerySnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { staffFunctions } from "../lib/firebase";
import { extractFirestoreIndexUrl, formatFirestoreIndexErrorMessage, isFirestoreCompositeIndexError } from "../lib/firestore-query-errors";
import { getDeliveryOrdersQuery, getRecentOrdersFallbackQuery } from "../services/orders.js";
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

  const [orders, setOrders] = useState<DeliveryOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenError, setListenError] = useState<string | null>(null);
  const [listenIndexUrl, setListenIndexUrl] = useState<string | null>(null);
  const [listenKey, setListenKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setListenError(null);
    setListenIndexUrl(null);
    setLoading(true);

    let unsubFallback: (() => void) | undefined;

    const applySnap = (snap: QuerySnapshot<DocumentData>) => {
      const merged = new Map<string, DeliveryOrderView>();
      for (const d of snap.docs) {
        const data = d.data();
        const st = String(data.status ?? "").toLowerCase();
        if (st !== "ready" && st !== "out_for_delivery") continue;
        const assigned = data.assignedTo && typeof data.assignedTo === "object" ? (data.assignedTo as Record<string, unknown>) : {};
        const deliveryId = typeof assigned.deliveryId === "string" ? assigned.deliveryId : "";
        const partner = typeof data.deliveryPartnerId === "string" ? data.deliveryPartnerId : "";
        const boy = typeof data.deliveryBoyId === "string" ? data.deliveryBoyId : "";
        const mine = deliveryId === uid || partner === uid || boy === uid;
        if (st === "ready" || (st === "out_for_delivery" && mine)) {
          merged.set(d.id, parseOrderDoc(d.id, data));
        }
      }
      const arr = Array.from(merged.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
      setOrders(arr);
      setLoading(false);
    };

    const unsubPrimary = onSnapshot(
      getDeliveryOrdersQuery(),
      applySnap,
      (err) => {
        if (!isFirestoreCompositeIndexError(err)) {
          const { body } = formatFirestoreIndexErrorMessage(err);
          setListenError(err instanceof Error ? err.message : body);
          setListenIndexUrl(extractFirestoreIndexUrl(err));
          setLoading(false);
          return;
        }
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[delivery-board] Missing composite index — using recent-orders fallback.");
        }
        unsubFallback = onSnapshot(
          getRecentOrdersFallbackQuery(),
          applySnap,
          (err2) => {
            const { body } = formatFirestoreIndexErrorMessage(err2);
            setListenError(err2 instanceof Error ? err2.message : body);
            setListenIndexUrl(extractFirestoreIndexUrl(err2));
            setLoading(false);
          }
        );
      }
    );

    return () => {
      unsubPrimary();
      unsubFallback?.();
    };
  }, [uid, listenKey]);

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
        <Text style={{ color: "#991B1B", fontWeight: "800", fontSize: 16 }}>Could not sync deliveries</Text>
        <Text style={{ color: "#7f1d1d", marginTop: 8, fontSize: 13, lineHeight: 18 }}>{listenError}</Text>
        {listenIndexUrl ? (
          <TouchableOpacity
            onPress={() => void Linking.openURL(listenIndexUrl)}
            style={{ marginTop: 12, alignSelf: "flex-start", backgroundColor: staffColors.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
          >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>Open index in Firebase Console</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => {
            setListenError(null);
            setListenIndexUrl(null);
            setLoading(true);
            setListenKey((k) => k + 1);
          }}
          style={{
            marginTop: 12,
            alignSelf: "flex-start",
            borderWidth: 1,
            borderColor: "#fecaca",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: "white"
          }}
        >
          <Text style={{ color: "#991B1B", fontWeight: "800", fontSize: 13 }}>Retry</Text>
        </TouchableOpacity>
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
        <Text style={{ color: staffColors.muted, fontSize: 13, marginBottom: 8 }}>
          Live feed includes only ready and active runs (delivered orders are omitted to reduce sync load).
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: 280 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{completedOrders.map((o) => renderCard(o, false))}</View>
        </ScrollView>
      )}
    </View>
  );
}
