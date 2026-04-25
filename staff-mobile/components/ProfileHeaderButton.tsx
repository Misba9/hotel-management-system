import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";

/** Opens the shared profile route (all roles). */
export function ProfileHeaderButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(shared)/profile")}
      style={styles.hit}
      hitSlop={8}
    >
      <Text style={styles.label}>Profile</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { paddingHorizontal: 12, paddingVertical: 6 },
  label: { fontSize: 16, fontWeight: "700", color: "#2563eb" }
});
