import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { staffAuth } from "../../src/lib/firebase";
import { useAuthStore } from "../../store/useAuthStore";
import {
  fetchOrderDetailForDelivery,
  markDeliveryDelivered,
  markDeliveryPicked,
  publishRiderLocation,
  sendDeliveryMessage,
  subscribeDeliveryDoc,
  subscribeDeliveryMessages,
  type DeliveryMessage,
  type DeliveryRow,
  type OrderDeliveryDetail
} from "../../services/delivery";

type HeaderProps = {
  delivery: DeliveryRow;
  order: OrderDeliveryDetail | null;
  itemsForList: OrderDeliveryDetail["items"];
  locHint: string | null;
  status: string;
  notAssignee: boolean;
  actionBusy: boolean;
  onPicked: () => void;
  onDelivered: () => void;
};

function DeliveryDetailHeader({
  delivery,
  order,
  itemsForList,
  locHint,
  status,
  notAssignee,
  actionBusy,
  onPicked,
  onDelivered
}: HeaderProps) {
  return (
    <View style={styles.scroll}>
      {notAssignee ? (
        <Text style={styles.warn}>You are not the assigned rider for this run.</Text>
      ) : null}

      <Text style={styles.h1}>{order?.customerName ?? delivery.customerName}</Text>
      <Text style={styles.phone}>{order?.mobile || delivery.mobile || "—"}</Text>
      <Text style={styles.addr}>{order?.address || delivery.address}</Text>
      {order?.tokenNumber != null ? <Text style={styles.token}>Token #{order.tokenNumber}</Text> : null}

      <Text style={styles.section}>Items</Text>
      {itemsForList.length === 0 ? (
        <Text style={styles.muted}>No line items on the order document.</Text>
      ) : (
        itemsForList.map((it, i) => (
          <Text key={`${it.name}-${i}`} style={styles.line}>
            {it.qty}× {it.name} · ₹{it.price}
          </Text>
        ))
      )}
      {order != null && order.total > 0 ? <Text style={styles.total}>Total ₹{order.total}</Text> : null}

      <View style={styles.statusRow}>
        <Text style={styles.chip}>Status: {delivery.status}</Text>
        {locHint ? <Text style={styles.locHint}>{locHint}</Text> : null}
      </View>

      <View style={styles.actions}>
        {status === "assigned" ? (
          <Pressable
            style={[styles.btn, styles.pickup, actionBusy && styles.disabled]}
            disabled={actionBusy || Boolean(notAssignee)}
            onPress={onPicked}
          >
            {actionBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Picked</Text>}
          </Pressable>
        ) : null}
        {status === "picked" ? (
          <Pressable
            style={[styles.btn, styles.done, actionBusy && styles.disabled]}
            disabled={actionBusy || Boolean(notAssignee)}
            onPress={onDelivered}
          >
            {actionBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Delivered</Text>}
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.section, styles.msgSection]}>Messages</Text>
    </View>
  );
}

export type DeliveryDetailViewProps = {
  deliveryId: string;
};

export function DeliveryDetailView({ deliveryId: deliveryIdProp }: DeliveryDetailViewProps) {
  const router = useRouter();
  const id = typeof deliveryIdProp === "string" ? deliveryIdProp.trim() : "";
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);

  const [delivery, setDelivery] = useState<DeliveryRow | null | undefined>(undefined);
  const [order, setOrder] = useState<OrderDeliveryDetail | null>(null);
  const [messages, setMessages] = useState<DeliveryMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [locHint, setLocHint] = useState<string | null>(null);

  const uid = staffAuth.currentUser?.uid ?? "";
  const riderName = profile?.name ?? user?.displayName ?? "Rider";
  const riderMobile =
    typeof user?.phoneNumber === "string" && user.phoneNumber.replace(/\D/g, "").length >= 8
      ? user.phoneNumber.trim()
      : "";

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeDeliveryDoc(
      id,
      (row) => setDelivery(row),
      (e) => Alert.alert("Delivery", e.message)
    );
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id || !delivery?.orderId) return;
    let cancelled = false;
    void (async () => {
      const o = await fetchOrderDetailForDelivery(delivery.orderId);
      if (!cancelled) setOrder(o);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, delivery?.orderId]);

  useEffect(() => {
    if (!id) return;
    return subscribeDeliveryMessages(id, setMessages, (e) => Alert.alert("Chat", e.message));
  }, [id]);

  const status = (delivery?.status ?? "").toLowerCase();
  const trackingActive = status === "assigned" || status === "picked";

  useEffect(() => {
    if (!id || !delivery?.orderId || !uid) {
      setLocHint(null);
      return;
    }
    if (!trackingActive) {
      setLocHint("Tracking stops after delivered.");
      return;
    }

    let watch: Location.LocationSubscription | null = null;
    let cancelled = false;

    void (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (perm !== "granted") {
        setLocHint("Location permission denied — customer map may not update.");
        return;
      }
      setLocHint("Live location on.");
      try {
        watch = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 35,
            timeInterval: 18_000
          },
          (loc) => {
            void publishRiderLocation({
              orderId: delivery.orderId,
              riderUid: uid,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              riderName,
              ...(riderMobile ? { riderMobile } : {})
            }).catch(() => {
              /* ignore transient write errors */
            });
          }
        );
      } catch {
        setLocHint("Could not start GPS watch.");
      }
    })();

    return () => {
      cancelled = true;
      watch?.remove();
    };
  }, [id, delivery?.orderId, uid, trackingActive, riderName, riderMobile]);

  const onPicked = useCallback(async () => {
    if (!id) return;
    setActionBusy(true);
    try {
      await markDeliveryPicked(id);
    } catch (e) {
      Alert.alert("Update failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setActionBusy(false);
    }
  }, [id]);

  const onDelivered = useCallback(async () => {
    if (!id) return;
    setActionBusy(true);
    try {
      await markDeliveryDelivered(id);
    } catch (e) {
      Alert.alert("Update failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setActionBusy(false);
    }
  }, [id]);

  const onSend = useCallback(async () => {
    if (!id || !draft.trim()) return;
    setSending(true);
    try {
      await sendDeliveryMessage(id, draft);
      setDraft("");
    } catch (e) {
      Alert.alert("Send failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }, [id, draft]);

  const itemsForList = useMemo(() => order?.items ?? [], [order]);

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Missing delivery id.</Text>
        <Pressable onPress={() => router.back()} style={styles.linkBtn}>
          <Text style={styles.linkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (delivery === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>This delivery was removed or you do not have access.</Text>
      </View>
    );
  }

  if (delivery === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  const notAssignee = delivery.deliveryBoyId && delivery.deliveryBoyId !== uid;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.msgList}
        contentContainerStyle={styles.msgListContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <DeliveryDetailHeader
            delivery={delivery}
            order={order}
            itemsForList={itemsForList}
            locHint={locHint}
            status={status}
            notAssignee={Boolean(notAssignee)}
            actionBusy={actionBusy}
            onPicked={() => void onPicked()}
            onDelivered={() => void onDelivered()}
          />
        }
        renderItem={({ item }) => {
          const mine = item.authorUid === uid;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={styles.bubbleText}>{item.body}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.muted, styles.msgEmpty]}>No messages yet.</Text>
        }
      />
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          style={styles.input}
          editable={!sending}
          onSubmitEditing={() => void onSend()}
        />
        <Pressable
          onPress={() => void onSend()}
          disabled={sending || !draft.trim()}
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.disabled]}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { padding: 16, paddingBottom: 8 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: "#64748b", fontSize: 14 },
  warn: { backgroundColor: "#fef3c7", color: "#92400e", padding: 10, borderRadius: 10, marginBottom: 12, fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  phone: { fontSize: 17, fontWeight: "700", color: "#2563eb", marginTop: 6 },
  addr: { fontSize: 15, color: "#334155", marginTop: 8, lineHeight: 22 },
  token: { marginTop: 8, fontSize: 14, fontWeight: "700", color: "#0f172a" },
  section: { marginTop: 18, fontSize: 13, fontWeight: "800", color: "#64748b", textTransform: "uppercase" },
  line: { fontSize: 15, color: "#0f172a", marginTop: 4 },
  total: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#0f172a" },
  statusRow: { marginTop: 14, gap: 6 },
  chip: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  locHint: { fontSize: 12, color: "#64748b" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  pickup: { backgroundColor: "#ea580c" },
  done: { backgroundColor: "#2563eb" },
  sendBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, borderRadius: 12, justifyContent: "center", minWidth: 72 },
  disabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "800" },
  msgList: { flex: 1, backgroundColor: "#fff" },
  msgListContent: { paddingHorizontal: 12, paddingBottom: 12 },
  msgSection: { marginTop: 20 },
  msgEmpty: { paddingHorizontal: 12, paddingBottom: 8 },
  bubble: { maxWidth: "88%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, marginBottom: 8 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: "#dbeafe" },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: "#f1f5f9" },
  bubbleText: { fontSize: 15, color: "#0f172a" },
  composer: { flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100
  },
  linkBtn: { marginTop: 16 },
  linkText: { color: "#2563eb", fontWeight: "700" }
});
