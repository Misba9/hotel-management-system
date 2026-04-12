import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { shell, shellShadow } from "../../theme/shell-theme";

/**
 * Auto-dismiss toast-style banner (4s) + manual dismiss.
 * @param {{ message: string; tone?: 'info' | 'success'; onDismiss: () => void }}
 */
export function InAppBanner({ message, tone = "info", onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(), 4200);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  const border = tone === "success" ? "#0D9488" : shell.primary;
  const bg = tone === "success" ? "#ECFDF5" : "#FFF1F2";

  return (
    <View style={[styles.wrap, shellShadow(4), { borderColor: border, backgroundColor: bg }]}>
      <Text style={styles.text}>{message}</Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Text style={styles.dismiss}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  text: { flex: 1, fontSize: 14, fontWeight: "700", color: shell.text, lineHeight: 20 },
  dismiss: { fontSize: 16, color: shell.muted, fontWeight: "700" }
});
