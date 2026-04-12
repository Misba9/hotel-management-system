import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { shell, shellShadow } from "../../theme/shell-theme";

/**
 * @param {{ label: string, value: string | number, hint?: string, accentColor?: string }}
 */
export function StatCard({ label, value, hint, accentColor = shell.primary }) {
  return (
    <View style={[styles.card, shellShadow(3)]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 16,
    padding: 16,
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.border
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: shell.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  value: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  hint: {
    marginTop: 6,
    fontSize: 11,
    color: shell.muted
  }
});
