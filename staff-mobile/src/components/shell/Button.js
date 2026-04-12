import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { shell, shellShadow } from "../../theme/shell-theme";

/**
 * @param {{ title: string, onPress: () => void, variant?: 'primary' | 'secondary', disabled?: boolean, loading?: boolean, style?: object }}
 */
export function Button({ title, onPress, variant = "primary", disabled = false, loading = false, style }) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        shellShadow(isPrimary ? 3 : 1),
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#fff" : shell.primary} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  primary: {
    backgroundColor: shell.primary
  },
  secondary: {
    backgroundColor: shell.surface,
    borderWidth: 1.5,
    borderColor: shell.border
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.92 },
  label: { fontSize: 16, fontWeight: "700" },
  labelPrimary: { color: "#fff" },
  labelSecondary: { color: shell.primary }
});
