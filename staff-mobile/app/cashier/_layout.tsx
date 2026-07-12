import { Tabs, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { signOut } from "firebase/auth";

import { staffAuth as auth } from "../../src/lib/firebase";
import { useRoleShellGuard } from "../../src/hooks/use-role-shell-guard";

function CashierHeaderActions() {
  const router = useRouter();
  const user = auth?.currentUser;

  const handleProfile = useCallback(() => {
    try {
      if (!router) return;
      router.push("/profile");
    } catch (e) {
      console.log("Navigation error", e);
    }
  }, [router]);

  const handleLogout = useCallback(async () => {
    try {
      if (!auth) return;
      await signOut(auth);
      if (router) router.replace("/login");
    } catch (error) {
      console.log("Logout error:", error);
      Alert.alert("Could not logout", error instanceof Error ? error.message : "Try again.");
    }
  }, [router]);

  if (!auth) {
    return null;
  }
  if (!router) {
    return (
      <View>
        <Text>Cashier</Text>
      </View>
    );
  }

  return (
    <View style={styles.actions}>
      <Text style={styles.userText} numberOfLines={1}>
        {user?.email ?? "Guest"}
      </Text>
      <Pressable onPress={handleProfile} style={styles.profileBtn} hitSlop={10}>
        <Text style={styles.profileText}>Profile</Text>
      </Pressable>
      <Pressable onPress={() => void handleLogout()} style={styles.logoutBtn} hitSlop={10}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

export default function CashierLayout() {
  useRoleShellGuard(["cashier"]);

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: "#0f1419" },
        headerShadowVisible: false,
        headerTitle: "Cashier POS",
        headerTintColor: "#f1f5f9",
        headerRight: () => <CashierHeaderActions />,
        tabBarStyle: Platform.select({
          web: { display: "none" },
          default: { height: 0, minHeight: 0, overflow: "hidden" as const }
        }),
        tabBarShowLabel: false
      }}
    >
      <Tabs.Screen name="billing" options={{ title: "POS", headerShown: false }} />
      <Tabs.Screen name="walk-in" options={{ href: null, title: "New Order" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 1 },
  userText: { fontSize: 12, color: "#94a3b8", marginRight: 4, flexShrink: 1 },
  profileBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  profileText: { fontSize: 15, fontWeight: "700", color: "#3b82f6" },
  logoutBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#ef4444" }
});
