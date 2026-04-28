import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged, type User } from "firebase/auth";

import { roleHomeHref } from "../src/lib/staff-role-home";
import { staffAuth } from "../src/lib/firebase";
import { logout as signOutStaff } from "../services/auth";
import { subscribeStaffProfile, type StaffProfileLoadResult } from "../services/staff-profile";
import type { StaffRoleId } from "../src/constants/staff-roles";

const ROLE_LABEL: Record<StaffRoleId, string> = {
  admin: "Admin",
  manager: "Manager",
  kitchen: "Kitchen",
  cashier: "Cashier",
  delivery: "Delivery",
  waiter: "Waiter"
};

export default function ProfileScreen() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(staffAuth.currentUser);
  const [loading, setLoading] = useState(true);
  const [submittingLogout, setSubmittingLogout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileResult, setProfileResult] = useState<StaffProfileLoadResult | null>(null);

  useEffect(() => onAuthStateChanged(staffAuth, setAuthUser), []);

  useEffect(() => {
    if (!authUser) {
      setProfileResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeStaffProfile(
      authUser,
      (result) => {
        setProfileResult(result);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [authUser]);

  const role = profileResult?.ok ? profileResult.profile.role : null;
  const profile = profileResult?.ok ? profileResult.profile : null;
  const phoneNumber = profile?.phoneNumber?.trim() || authUser?.phoneNumber || "Not available";
  const roleLabel = role ? ROLE_LABEL[role] : "Unassigned";
  const roleColor = useMemo(() => {
    if (!role) return styles.badgePending;
    if (role === "kitchen") return styles.badgeKitchen;
    if (role === "waiter") return styles.badgeWaiter;
    return styles.badgeDefault;
  }, [role]);

  const onLogout = async () => {
    setSubmittingLogout(true);
    try {
      await signOutStaff();
      router.replace("/login");
    } finally {
      setSubmittingLogout(false);
    }
  };

  const goHome = () => {
    if (role) router.replace(roleHomeHref(role));
    else router.back();
  };

  const renderRoleAction = () => {
    if (!role) return null;
    if (role === "kitchen") {
      return (
        <Pressable style={styles.actionPrimary} onPress={() => router.replace("/kitchen/orders")}>
          <Text style={styles.actionPrimaryText}>Go to Kitchen Orders</Text>
        </Pressable>
      );
    }
    if (role === "waiter") {
      return (
        <View style={styles.waiterActions}>
          <Pressable style={styles.actionPrimary} onPress={() => router.replace("/waiter")}>
            <Text style={styles.actionPrimaryText}>Open Waiter Floor</Text>
          </Pressable>
          <Text style={styles.waiterHint}>Use waiter floor to access active table and order screens.</Text>
        </View>
      );
    }
    return (
      <Pressable style={styles.actionSecondary} onPress={goHome}>
        <Text style={styles.actionSecondaryText}>Open Role Dashboard</Text>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.stateText}>Loading profile...</Text>
      </View>
    );
  }

  if (!authUser) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Not signed in</Text>
        <Text style={styles.stateText}>Please sign in to view your profile.</Text>
        <Pressable style={styles.actionPrimary} onPress={() => router.replace("/login")}>
          <Text style={styles.actionPrimaryText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  if (!profileResult?.ok) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Profile unavailable</Text>
        <Text style={styles.stateText}>{error ?? profileResult?.reason ?? "Could not load profile."}</Text>
        <Pressable style={styles.logout} onPress={() => void onLogout()} disabled={submittingLogout}>
          <Text style={styles.logoutText}>{submittingLogout ? "Signing out..." : "Sign out"}</Text>
        </Pressable>
      </View>
    );
  }

  const loadedProfile = profileResult.profile;

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Pressable onPress={goHome} hitSlop={12}>
          <Text style={styles.back}>← Home</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, roleColor]}>
            <Text style={styles.badgeText}>{roleLabel}</Text>
          </View>
        </View>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{loadedProfile.name}</Text>
        <Text style={[styles.label, { marginTop: 16 }]}>Phone</Text>
        <Text style={styles.value}>{phoneNumber}</Text>
        <Text style={[styles.label, { marginTop: 16 }]}>Role</Text>
        <Text style={styles.value}>{roleLabel}</Text>
        <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
        <Text style={styles.value}>{loadedProfile.email || authUser.email || "Not available"}</Text>
      </View>
      {renderRoleAction()}
      <Pressable style={styles.logout} onPress={() => void onLogout()} disabled={submittingLogout}>
        <Text style={styles.logoutText}>{submittingLogout ? "Signing out..." : "Sign out"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc", padding: 20 },
  centered: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  stateTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  stateText: { fontSize: 14, color: "#475569", textAlign: "center", marginTop: 10, marginBottom: 16 },
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
  badgeRow: { marginBottom: 10, flexDirection: "row" },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.4 },
  badgeKitchen: { backgroundColor: "#c2410c" },
  badgeWaiter: { backgroundColor: "#2563eb" },
  badgeDefault: { backgroundColor: "#334155" },
  badgePending: { backgroundColor: "#64748b" },
  label: { fontSize: 12, fontWeight: "700", color: "#64748b", letterSpacing: 0.6 },
  value: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginTop: 4 },
  waiterActions: { marginTop: 16, gap: 8 },
  waiterHint: { fontSize: 12, color: "#475569" },
  actionPrimary: {
    marginTop: 18,
    backgroundColor: "#0f766e",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center"
  },
  actionPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  actionSecondary: {
    marginTop: 18,
    backgroundColor: "#e2e8f0",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center"
  },
  actionSecondaryText: { color: "#0f172a", fontWeight: "800", fontSize: 14 },
  logout: {
    marginTop: 14,
    backgroundColor: "#b91c1c",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center"
  },
  logoutText: { color: "#fff", fontWeight: "800", fontSize: 16 }
});
