import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { useAuth } from "../context/AuthProvider";
import { InAppBanner, OrderCard, ScreenTopBar } from "../components/shell";
import { StaffErrorView } from "../components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { EmptyState } from "../components/ux/empty-state";
import { staffFunctions } from "../lib/firebase";
import { formatOrderRelativeTime, subscribeKitchenOrders } from "../services/orders.js";
import { useOrderNotifications } from "../services/notifications.js";
import { shell } from "../theme/shell-theme";
import { space } from "../theme/design-tokens";

/**
 * Kitchen — realtime `orders` via onSnapshot; pull-to-refresh rebinds listener.
 */
function KitchenLiveContent() {
  const { signOutUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listenerKey, setListenerKey] = useState(0);
  const [error, setError] = useState(null);
  const { banner, dismissBanner, badgeCount } = useOrderNotifications("kitchen", orders);

  useEffect(() => {
    setError(null);
    const unsub = subscribeKitchenOrders(
      (list) => {
        setLoading(false);
        setRefreshing(false);
        setOrders(list);
      },
      (err) => {
        setLoading(false);
        setRefreshing(false);
        const code = err instanceof FirebaseError ? err.code : "";
        setError(
          code === "permission-denied"
            ? "Firestore blocked reading orders. Check security rules for kitchen access."
            : err?.message ?? "Could not load kitchen queue."
        );
      }
    );
    return unsub;
  }, [listenerKey]);

  const bumpListener = useCallback(() => {
    setListenerKey((k) => k + 1);
  }, []);

  const onRetryAfterError = useCallback(() => {
    setError(null);
    setLoading(true);
    bumpListener();
  }, [bumpListener]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    bumpListener();
  }, [bumpListener]);

  const updateViaCallable = useCallback(async (orderId, status) => {
    const callable = httpsCallable(staffFunctions, "updateOrderStatusV1");
    await callable({ orderId, status });
  }, []);

  const onAccept = useCallback(
    async (orderId) => {
      try {
        await updateViaCallable(orderId, "preparing");
      } catch (e) {
        const msg = e instanceof FirebaseError ? e.message : String(e);
        setError(msg);
      }
    },
    [updateViaCallable]
  );

  const onReady = useCallback(
    async (orderId) => {
      try {
        await updateViaCallable(orderId, "ready");
      } catch (e) {
        const msg = e instanceof FirebaseError ? e.message : String(e);
        setError(msg);
      }
    },
    [updateViaCallable]
  );

  if (loading && orders.length === 0 && !error) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenTopBar title="Kitchen" subtitle="Live queue" badgeCount={badgeCount} onSignOut={() => void signOutUser()} />
        <StaffLoadingView message="Syncing kitchen queue…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenTopBar
        title="Kitchen"
        subtitle="Live queue · pull to refresh"
        badgeCount={badgeCount}
        onSignOut={() => void signOutUser()}
      />
      {banner ? (
        <InAppBanner message={banner.message} tone={banner.tone} onDismiss={dismissBanner} />
      ) : null}

      {error ? (
        <View style={styles.errorPad}>
          <StaffErrorView message={error} onRetry={onRetryAfterError} />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={shell.primary}
            colors={[shell.primary]}
          />
        }
      >
        {!error && orders.length === 0 ? (
          <EmptyState
            icon="🍳"
            title="All caught up"
            subtitle="New POS orders appear here in real time. Pull down to refresh."
          />
        ) : null}

        {!error
          ? orders.map((o) => {
          const st = String(o.status ?? "").toLowerCase();
          const actions = [];
          if (["pending", "accepted", "created", "confirmed"].includes(st)) {
            actions.push({
              title: "Accept",
              onPress: () => void onAccept(o.id),
              variant: "primary"
            });
          }
          if (st === "preparing") {
            actions.push({
              title: "Mark ready",
              onPress: () => void onReady(o.id),
              variant: "primary"
            });
          }
          return (
            <OrderCard
              key={o.id}
              variant="kitchen"
              orderId={o.id.length > 10 ? `${o.id.slice(0, 8)}…` : o.id}
              items={o.items.map((it) => ({ name: it.name, qty: it.qty }))}
              timeLabel={formatOrderRelativeTime(o.createdAt)}
              status={o.status}
              actions={actions}
            />
          );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function KitchenScreen() {
  return (
    <FeatureGate feature="kitchen_orders" fallback={<NoAccessView subtitle="Kitchen order list is not available for your role." />}>
      <KitchenLiveContent />
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.bg },
  errorPad: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  scroll: { padding: space.lg, paddingBottom: space.section }
});
