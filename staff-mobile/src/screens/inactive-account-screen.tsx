import React from "react";
import { Text, View } from "react-native";
import { useStaffAuth } from "../context/staff-auth-context";

/** Shown when `staff_users` has a real role but `isActive` is false. */
export function InactiveAccountScreen() {
  const { signOutUser } = useStaffAuth();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 28, backgroundColor: "#FFF8F3" }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#92400E", textAlign: "center" }}>Account paused</Text>
      <Text style={{ marginTop: 12, color: "#64748b", textAlign: "center", lineHeight: 22 }}>
        Your account is inactive. Ask an administrator to enable access in the admin panel.
      </Text>
      <Text onPress={() => void signOutUser()} style={{ marginTop: 28, color: "#FF6B35", fontWeight: "700", fontSize: 16 }}>
        Sign out
      </Text>
    </View>
  );
}
