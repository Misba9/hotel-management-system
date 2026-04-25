import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";

export function ProfileNavButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/profile")} style={styles.btn} hitSlop={10}>
      <Text style={styles.txt}>Profile</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 10, paddingVertical: 6 },
  txt: { fontSize: 15, fontWeight: "700", color: "#2563eb" }
});
