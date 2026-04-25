import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

import { DeliveryCard } from "../DeliveryCard";
import { fetchDeliveryByOrderId, fetchOrderByTokenNumber, subscribeAssignedDeliveries, type DeliveryRow } from "../../services/delivery";

type DeliveryHomeTab = "runs" | "start";

export function DeliveryHomeView() {
  const router = useRouter();
  const [tab, setTab] = useState<DeliveryHomeTab>("runs");
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tokenText, setTokenText] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAssignedDeliveries(
      (next) => {
        setRows(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const onLookup = useCallback(async () => {
    const n = Math.floor(Number(String(tokenText).trim()));
    if (!Number.isFinite(n) || n < 1) {
      Alert.alert("Token", "Enter a valid token number.");
      return;
    }
    setLookupBusy(true);
    try {
      const order = await fetchOrderByTokenNumber(n);
      if (!order) {
        Alert.alert("Not found", "No order matches this token.");
        return;
      }
      const delivery = await fetchDeliveryByOrderId(order.orderId);
      if (!delivery) {
        Alert.alert(
          "No delivery",
          `Order ${order.orderId.slice(0, 8)}… has no delivery assignment yet. Ask the counter to assign a rider.`
        );
        return;
      }
      router.push(`/delivery/${delivery.id}`);
    } catch (e) {
      Alert.alert("Lookup failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLookupBusy(false);
    }
  }, [router, tokenText]);

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        <Pressable onPress={() => setTab("runs")} style={[styles.tabBtn, tab === "runs" && styles.tabBtnOn]}>
          <Text style={[styles.tabText, tab === "runs" && styles.tabTextOn]}>My runs</Text>
        </Pressable>
        <Pressable onPress={() => setTab("start")} style={[styles.tabBtn, tab === "start" && styles.tabBtnOn]}>
          <Text style={[styles.tabText, tab === "start" && styles.tabTextOn]}>Start</Text>
        </Pressable>
      </View>

      {tab === "runs" ? (
        <View style={styles.flex}>
          <Text style={styles.heading}>Deliveries</Text>
          <Text style={styles.sub}>Assigned to you — live from the deliveries collection.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading && rows.length === 0 ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          ) : null}
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <DeliveryCard row={item} />}
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.empty}>No orders available</Text>
              ) : (
                <Text style={styles.empty}> </Text>
              )
            }
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.startWrap}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Text style={styles.heading}>Start by token</Text>
          <Text style={styles.sub}>Enter the kitchen token from the receipt to open the assigned run.</Text>
          <TextInput
            value={tokenText}
            onChangeText={setTokenText}
            placeholder="Token #"
            keyboardType="number-pad"
            style={styles.input}
            editable={!lookupBusy}
          />
          <Pressable
            onPress={() => void onLookup()}
            disabled={lookupBusy}
            style={({ pressed }) => [
              styles.btn,
              lookupBusy && styles.btnDisabled,
              pressed && !lookupBusy && styles.pressed
            ]}
          >
            {lookupBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Open delivery</Text>}
          </Pressable>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  flex: { flex: 1 },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center"
  },
  tabBtnOn: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  tabText: { fontSize: 15, fontWeight: "800", color: "#475569" },
  tabTextOn: { color: "#fff" },
  heading: { fontSize: 24, fontWeight: "800", color: "#0f172a", paddingHorizontal: 16, paddingTop: 8 },
  sub: { fontSize: 14, color: "#64748b", paddingHorizontal: 16, marginBottom: 8 },
  error: { color: "#b91c1c", paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingBottom: 24 },
  empty: { textAlign: "center", marginTop: 48, color: "#64748b", fontSize: 15 },
  loaderWrap: { paddingVertical: 24, alignItems: "center" },
  startWrap: { flex: 1, padding: 16, paddingTop: 20 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  btn: {
    marginTop: 14,
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
