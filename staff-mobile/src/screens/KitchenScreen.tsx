import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { InAppBanner, ScreenTopBar } from "../components/shell";
import { StaffErrorView } from "../components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { EmptyState } from "../components/ux/empty-state";
import { useAuth } from "../context/AuthProvider";
import { useKitchenQueue, type KitchenQueueOrder } from "../hooks/use-kitchen-queue";
import { space, radius, elevation } from "../theme/design-tokens";
import { staffColors, cardShadow } from "../theme/staff-ui";
import { shell } from "../theme/shell-theme";
import { useOrderNotifications } from "../services/notifications.js";
import {
  acceptKitchenTableOrder,
  formatKitchenOrderUpdateError,
  markKitchenTableOrderReady
} from "../services/update-kitchen-table-order";
import { displayStatusLabel, themeForBucket, bucketForStatus } from "../components/kitchen-dashboard/kitchen-status-theme";

function formatRelativeTime(d: Date | null): string {
  if (!d) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}

function KitchenOrderCard({
  order,
  busy,
  onAccept,
  onReady
}: {
  order: KitchenQueueOrder;
  busy: boolean;
  onAccept: (id: string) => void;
  onReady: (id: string) => void;
}) {
  const st = order.status.trim().toUpperCase();
  const bucket = bucketForStatus(order.status);
  const theme = themeForBucket(bucket);
  const tableLabel =
    order.tableNumber != null && Number.isFinite(order.tableNumber)
      ? `Table ${order.tableNumber}`
      : order.orderType.toLowerCase() === "table"
        ? "Table —"
        : "Order";

  return (
    <View style={[styles.card, cardShadow(), { borderLeftColor: theme.accent, borderLeftWidth: 4 }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardTopLeft}>
          <Text style={styles.tableTitle}>{tableLabel}</Text>
          <Text style={styles.orderId} numberOfLines={1}>
            #{order.id.slice(0, 10)}…
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: theme.badgeBg }]}>
          <Text style={[styles.statusBadgeText, { color: theme.badgeFg }]}>{displayStatusLabel(order.status)}</Text>
        </View>
      </View>
      <Text style={styles.timeMeta}>{formatRelativeTime(order.createdAt)}</Text>

      <Text style={styles.itemsHeading}>Items</Text>
      {order.items.length === 0 ? (
        <Text style={styles.itemLine}>—</Text>
      ) : (
        order.items.map((line, i) => (
          <Text key={`${order.id}-i-${i}`} style={styles.itemLine}>
            {line.name} × {line.quantity}
          </Text>
        ))
      )}

      {order.totalAmount > 0 ? (
        <Text style={styles.totalLine}>Total ₹{order.totalAmount.toFixed(0)}</Text>
      ) : null}

      <View style={styles.actions}>
        {st === "PLACED" ? (
          <Pressable
            onPress={() => onAccept(order.id)}
            disabled={busy}
            style={({ pressed }) => [styles.btnPrimary, busy && styles.btnDisabled, pressed && !busy && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Accept</Text>
            )}
          </Pressable>
        ) : null}
        {st === "PREPARING" ? (
          <Pressable
            onPress={() => onReady(order.id)}
            disabled={busy}
            style={({ pressed }) => [styles.btnReady, busy && styles.btnDisabled, pressed && !busy && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnReadyText}>Ready</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function KitchenLiveContent() {
  const { signOutUser } = useAuth();
  const { orders, loading, error, refreshing, refresh } = useKitchenQueue(true);
  type KitchenNotif = {
    banner: { message: string; tone?: string } | null;
    dismissBanner: () => void;
    badgeCount: number;
  };
  const { banner, dismissBanner, badgeCount } = useOrderNotifications(
    "kitchen",
    orders as never
  ) as KitchenNotif;
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const runUpdate = useCallback(async (orderId: string, fn: (id: string) => Promise<void>) => {
    setUpdatingId(orderId);
    try {
      await fn(orderId);
    } catch (e) {
      Alert.alert("Update failed", formatKitchenOrderUpdateError(e));
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const onAccept = useCallback(
    (orderId: string) => void runUpdate(orderId, acceptKitchenTableOrder),
    [runUpdate]
  );
  const onReady = useCallback(
    (orderId: string) => void runUpdate(orderId, markKitchenTableOrderReady),
    [runUpdate]
  );

  if (loading && orders.length === 0 && !error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScreenTopBar title="Kitchen" subtitle="PLACED · PREPARING" badgeCount={badgeCount} onSignOut={() => void signOutUser()} />
        <StaffLoadingView message="Listening for orders…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScreenTopBar
        title="Kitchen"
        subtitle="Live · status in PLACED, PREPARING"
        badgeCount={badgeCount}
        onSignOut={() => void signOutUser()}
      />
      {banner ? (
        <InAppBanner
          message={banner.message}
          tone={banner.tone === "success" ? "success" : "info"}
          onDismiss={dismissBanner}
        />
      ) : null}

      {error ? (
        <View style={styles.errorPad}>
          <StaffErrorView message={error} onRetry={refresh} />
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
        {!error && orders.length === 0 ? (
          <EmptyState
            icon="🍳"
            title="Queue clear"
            subtitle="Table tickets with status PLACED or PREPARING appear here in real time."
          />
        ) : null}

        {!error
          ? orders.map((o) => (
              <KitchenOrderCard
                key={o.id}
                order={o}
                busy={updatingId === o.id}
                onAccept={onAccept}
                onReady={onReady}
              />
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function KitchenScreen() {
  return (
    <FeatureGate feature="kitchen_orders" fallback={<NoAccessView subtitle="Kitchen queue is not available for your role." />}>
      <KitchenLiveContent />
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.bg },
  errorPad: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  scroll: { padding: space.lg, paddingBottom: space.section },
  card: {
    backgroundColor: staffColors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: staffColors.border,
    ...elevation(2)
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTopLeft: { flex: 1, marginRight: space.sm },
  tableTitle: { fontSize: 20, fontWeight: "900", color: staffColors.text, letterSpacing: -0.3 },
  orderId: { marginTop: 4, fontSize: 13, fontWeight: "600", color: staffColors.muted },
  statusBadge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.full
  },
  statusBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  timeMeta: { marginTop: space.sm, fontSize: 12, color: staffColors.muted, fontWeight: "600" },
  itemsHeading: {
    marginTop: space.md,
    fontSize: 11,
    fontWeight: "800",
    color: staffColors.muted,
    letterSpacing: 0.5
  },
  itemLine: { marginTop: 6, fontSize: 15, fontWeight: "600", color: staffColors.text },
  totalLine: { marginTop: space.sm, fontSize: 14, fontWeight: "800", color: staffColors.accent },
  actions: { marginTop: space.lg, flexDirection: "row", gap: space.md },
  btnPrimary: {
    flex: 1,
    backgroundColor: staffColors.accent,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  btnReady: {
    flex: 1,
    backgroundColor: "#15803D",
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnReadyText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 }
});
