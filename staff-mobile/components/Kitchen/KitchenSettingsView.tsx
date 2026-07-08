import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useKitchenAutoPrintSetting } from "../../src/hooks/use-kitchen-auto-print-setting";

export function KitchenSettingsView() {
  const { autoPrintEnabled, autoPrintReady, savingAutoPrint, setAutoPrintEnabled } =
    useKitchenAutoPrintSetting();

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Kitchen Settings</Text>
      <Text style={styles.sub}>Configure how tickets behave on this device.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.label}>Auto-print KOT</Text>
            <Text style={styles.hint}>
              When on, new kitchen tickets print automatically. When off, use Print on each ticket.
            </Text>
          </View>
          {!autoPrintReady ? (
            <ActivityIndicator color="#ea580c" />
          ) : (
            <Switch
              value={autoPrintEnabled}
              disabled={savingAutoPrint}
              onValueChange={(value) => void setAutoPrintEnabled(value)}
              trackColor={{ false: "#475569", true: "#fdba74" }}
              thumbColor={autoPrintEnabled ? "#ea580c" : "#cbd5e1"}
            />
          )}
        </View>
        <Text style={styles.status}>
          {autoPrintEnabled ? "Auto-print is ON" : "Auto-print is OFF (manual print only)"}
        </Text>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Manual print</Text>
        <Text style={styles.noteText}>
          The Print button on each ticket always works, whether auto-print is on or off.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  heading: { fontSize: 28, fontWeight: "900", color: "#f8fafc", marginBottom: 6 },
  sub: { fontSize: 14, color: "#94a3b8", marginBottom: 16, lineHeight: 20 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 16
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  label: { fontSize: 16, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  hint: { fontSize: 13, color: "#94a3b8", lineHeight: 18 },
  status: { marginTop: 12, fontSize: 13, fontWeight: "700", color: "#fdba74" },
  noteCard: {
    marginTop: 14,
    backgroundColor: "#172033",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 14
  },
  noteTitle: { fontSize: 14, fontWeight: "800", color: "#e2e8f0", marginBottom: 4 },
  noteText: { fontSize: 13, color: "#94a3b8", lineHeight: 18 }
});
