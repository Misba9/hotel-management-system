import React from "react";
import { StyleSheet, Text } from "react-native";
import { useAuth } from "../../context/AuthProvider";
import { logError } from "../../lib/error-logging";

export function WaiterSignOutButton() {
  const { signOutUser } = useAuth();
  return (
    <Text
      onPress={() => {
        void signOutUser().catch((e) => {
          logError("WaiterSignOutButton", e);
        });
      }}
      style={styles.signOut}
    >
      Sign out
    </Text>
  );
}

const styles = StyleSheet.create({
  signOut: { marginRight: 16, color: "#FF6B35", fontWeight: "600" }
});
