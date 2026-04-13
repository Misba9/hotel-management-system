import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { FirebaseError } from "firebase/app";
import { DeliveryMapWebPlaceholder, DeliveryTrackingMap } from "../components/delivery/delivery-tracking-map";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { useAuth } from "../context/AuthProvider";
import { InAppBanner, OrderCard, ScreenTopBar } from "../components/shell";
import { StaffErrorView } from "../components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { EmptyState } from "../components/ux/empty-state";
import { notifyCustomerDeliveredStub, staffDeliveredFeedback, useOrderNotifications } from "../services/notifications.js";
import { useOrders } from "../hooks/use-orders";
import {
  DEFAULT_DELIVERY_LAT,
  DEFAULT_DELIVERY_LNG,
  formatOrderRelativeTime,
  startDelivery,
  updateDeliveryLocation,
  updateOrderStatus
} from "../services/orders.js";
import { radius, space } from "../theme/design-tokens";
import { shell, shellShadow } from "../theme/shell-theme";

const MAP_H = Math.min(340, Dimensions.get("window").height * 0.36);

/** ~4s GPS samples; Firestore writes are throttled in {@link updateDeliveryLocation}. */
const WATCH_INTERVAL_MS = 4000;
const WATCH_DISTANCE_M = 12;

function assignedToRider(order, deliveryUid) {
  const a = order?.assignedTo;
  if (!a) return false;
  const id = a.deliveryId ?? a.delivery ?? "";
  return id === deliveryUid;
}

/**
 * Delivery — react-native-maps, rider GPS → `orders.riderLocation` + `deliveryLocations` mirror, customer pin from `deliveryLocation`.
 */
function DeliveryLiveContent() {
  const { signOutUser, user } = useAuth();
  const deliveryUid = user?.uid ?? "";
  const { orders, loading, error, refreshing, refresh, retry } = useOrders("delivery");
  const [me, setMe] = useState(null);
  const watchRef = useRef(null);
  const { banner, dismissBanner, badgeCount } = useOrderNotifications("delivery", orders);

  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    let cancelled = false;
    (async () => {
      const Location = await import("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeRun = useMemo(
    () => orders.find((o) => o.status === "out_for_delivery" && assignedToRider(o, deliveryUid)),
    [orders, deliveryUid]
  );

  /** Map focuses active delivery, else first ready order, else first row. */
  const mapFocusOrder = useMemo(() => {
    if (activeRun) return activeRun;
    const ready = orders.filter((o) => o.status === "ready");
    if (ready.length) return ready[0];
    return orders[0] ?? null;
  }, [activeRun, orders]);

  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    if (!activeRun || !deliveryUid) {
      watchRef.current?.remove();
      watchRef.current = null;
      return undefined;
    }
    let cancelled = false;

    (async () => {
      const Location = await import("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: WATCH_INTERVAL_MS,
          distanceInterval: WATCH_DISTANCE_M
        },
        (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          setMe({ lat, lng });
          void updateDeliveryLocation(activeRun.id, { lat, lng });
        }
      );
      if (!cancelled) watchRef.current = sub;
    })();

    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [activeRun?.id, deliveryUid]);

  const customerDrop = mapFocusOrder?.deliveryLocation ?? { lat: DEFAULT_DELIVERY_LAT, lng: DEFAULT_DELIVERY_LNG };
  const riderPoint = useMemo(() => {
    if (me) return me;
    const rl = mapFocusOrder?.riderLocation;
    if (rl && typeof rl.lat === "number" && typeof rl.lng === "number") return { lat: rl.lat, lng: rl.lng };
    return null;
  }, [me, mapFocusOrder?.riderLocation]);

  const onStart = useCallback(
    async (orderId) => {
      try {
        await startDelivery(orderId, deliveryUid);
      } catch (e) {
        const msg = e instanceof FirebaseError ? e.message : String(e);
        Alert.alert("Could not start delivery", msg);
      }
    },
    [deliveryUid]
  );

  const onDelivered = useCallback(async (orderId) => {
    try {
      await updateOrderStatus(orderId, "delivered");
      void staffDeliveredFeedback();
      notifyCustomerDeliveredStub(orderId);
    } catch (e) {
      const msg = e instanceof FirebaseError ? e.message : String(e);
      Alert.alert("Could not mark delivered", msg);
    }
  }, []);

  const mapEl =
    Platform.OS === "web" ? (
      <DeliveryMapWebPlaceholder height={MAP_H} />
    ) : (
      <DeliveryTrackingMap
        customerDrop={customerDrop}
        rider={riderPoint}
        customerTitle="Drop-off"
        customerDescription={mapFocusOrder?.customer?.address || "Customer location"}
        showRoute
        mapHeight={MAP_H}
      />
    );

  if (!deliveryUid) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenTopBar title="Deliveries" subtitle="Sign in required" onSignOut={() => void signOutUser()} />
        <StaffErrorView message="No delivery account session." />
      </SafeAreaView>
    );
  }

  if (loading && !error) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenTopBar title="Deliveries" subtitle="Live map · GPS → Firestore" onSignOut={() => void signOutUser()} />
        <StaffLoadingView message="Loading route & orders…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenTopBar
        title="Deliveries"
        subtitle="Live map · pull to refresh"
        badgeCount={badgeCount}
        onSignOut={() => void signOutUser()}
      />
      {banner ? <InAppBanner message={banner.message} tone={banner.tone} onDismiss={dismissBanner} /> : null}

      <View style={[styles.mapWrap, shellShadow(3)]}>{mapEl}</View>
      {activeRun ? (
        <Text style={styles.trackingHint}>
          Tracking active · GPS every ~{Math.round(WATCH_INTERVAL_MS / 1000)}s · route is straight-line (road directions
          optional)
        </Text>
      ) : (
        <Text style={styles.trackingHint}>Start a delivery to broadcast your live position to the order and customers.</Text>
      )}

      {error ? (
        <View style={styles.errorPad}>
          <StaffErrorView message={error} onRetry={retry} />
        </View>
      ) : null}

      {!error && orders.length === 0 ? (
        <View style={styles.emptyPad}>
          <EmptyState
            icon="🛵"
            title="No deliveries right now"
            subtitle="Ready orders appear here. Pull down to refresh the list."
          />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={shell.primary}
            colors={[shell.primary]}
          />
        }
      >
        {!error
          ? orders.map((o) => {
              const actions = [];
              if (o.status === "ready") {
                actions.push({
                  title: "Start delivery",
                  onPress: () => void onStart(o.id),
                  variant: "primary"
                });
              }
              if (o.status === "out_for_delivery") {
                actions.push({
                  title: "Mark delivered",
                  onPress: () => void onDelivered(o.id),
                  variant: "primary"
                });
              }
              return (
                <OrderCard
                  key={o.id}
                  variant="delivery"
                  orderId={o.id.length > 10 ? `${o.id.slice(0, 8)}…` : o.id}
                  status={o.status}
                  timeLabel={formatOrderRelativeTime(o.updatedAt ?? o.createdAt)}
                  customerName={o.customer?.name || "Customer"}
                  address={o.customer?.address || "—"}
                  phone={o.customer?.phone || "—"}
                  actions={actions}
                />
              );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function DeliveryScreen() {
  return (
    <FeatureGate feature="delivery" fallback={<NoAccessView subtitle="Delivery is not available for your role." />}>
      <DeliveryLiveContent />
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.bg },
  mapWrap: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: shell.border
  },
  trackingHint: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    fontSize: 12,
    color: shell.muted,
    fontWeight: "600",
    lineHeight: 17
  },
  errorPad: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  emptyPad: { paddingHorizontal: space.lg },
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.section }
});
