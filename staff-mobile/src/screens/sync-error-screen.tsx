import React from "react";
import { Text, View } from "react-native";
import { useStaffAuth } from "../context/staff-auth-context";

/** Firestore listener failed (network, rules, or project mismatch). */
export function SyncErrorScreen() {
  const { signOutUser } = useStaffAuth();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 28, backgroundColor: "#FFF8F3" }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#0f172a", textAlign: "center" }}>Could not sync profile</Text>
      <Text style={{ marginTop: 12, color: "#64748b", textAlign: "center", lineHeight: 22 }}>
        Check your connection, Firebase project in `.env`, and Firestore rules. Then try signing in again.
      </Text>
      <Text onPress={() => void signOutUser()} style={{ marginTop: 28, color: "#FF6B35", fontWeight: "700", fontSize: 16 }}>
        Sign out
      </Text>
    </View>
  );
}
