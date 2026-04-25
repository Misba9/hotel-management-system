import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RestaurantPosOrderScreen } from "../../../components/RestaurantPosOrderScreen";

function parseTableNumber(raw: string | undefined, fallbackId: string): number {
  const n = Number(String(raw ?? "").trim());
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const fromId = parseInt(String(fallbackId).replace(/\D/g, ""), 10);
  return Number.isFinite(fromId) ? fromId : 0;
}

export default function WaiterTableOrderScreen() {
  const router = useRouter();
  const { tableId, tableNumber: tableNumberParam } = useLocalSearchParams<{
    tableId: string;
    tableNumber?: string;
  }>();
  const tableNumber = useMemo(
    () => parseTableNumber(tableNumberParam, String(tableId ?? "")),
    [tableId, tableNumberParam]
  );

  if (!tableId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid table.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <RestaurantPosOrderScreen
      tableFirestoreId={String(tableId)}
      tableNumber={tableNumber}
      linkTable
      confirmHint="Creates the ticket, sends it to the kitchen (preparing), and links this table."
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: "#64748b", marginBottom: 12 },
  backBtn: { marginTop: 8, padding: 12 },
  backBtnText: { color: "#0f172a", fontWeight: "700" }
});
