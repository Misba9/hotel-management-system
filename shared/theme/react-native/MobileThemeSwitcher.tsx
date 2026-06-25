import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMobileTheme, type ThemePreference } from "./MobileThemeProvider";

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" }
];

export function MobileThemeSwitcher() {
  const { preference, setPreference, colors } = useMobileTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Appearance</Text>
      <View style={styles.row}>
        {OPTIONS.map(({ value, label, icon }) => {
          const active = preference === value;
          return (
            <Pressable
              key={value}
              onPress={() => void setPreference(value)}
              style={[
                styles.option,
                { borderColor: colors.border },
                active && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
              ]}
            >
              <Feather name={icon} size={18} color={active ? colors.primary : colors.iconSecondary} />
              <Text style={[styles.label, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 15,
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  option: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  label: {
    fontSize: 12,
    fontWeight: "600"
  }
});
