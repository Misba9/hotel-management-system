import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { roleHomeHref } from "../src/lib/staff-role-home";
import { useAuthStore } from "../store/useAuthStore";

export default function ProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const profile = useAuthStore((s) => s.profile);
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const goHome = () => {
    if (role) router.replace(roleHomeHref(role));
    else router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Pressable onPress={goHome} hitSlop={12}>
          <Text style={styles.back}>← Home</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{profile?.name ?? "—"}</Text>
        <Text style={[styles.label, { marginTop: 16 }]}>Role</Text>
        <Text style={styles.value}>{role ?? "—"}</Text>
        <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
        <Text style={styles.value}>{user?.email ?? profile?.email ?? "—"}</Text>
      </View>
      <Pressable style={styles.logout} onPress={() => void onLogout()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc", padding: 20 },
  top: { marginBottom: 8 },
  back: { fontSize: 16, fontWeight: "700", color: "#2563eb" },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a", marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  label: { fontSize: 12, fontWeight: "700", color: "#64748b", letterSpacing: 0.6 },
  value: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginTop: 4 },
  logout: {
    marginTop: 28,
    backgroundColor: "#b91c1c",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center"
  },
  logoutText: { color: "#fff", fontWeight: "800", fontSize: 16 }
});
