import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged, type User } from "firebase/auth";

import { MobileThemeSwitcher } from "../../shared/theme/react-native/MobileThemeSwitcher";
import { useThemeColors } from "../../shared/theme/react-native/MobileThemeProvider";
import { ResponsiveScreen } from "../src/components/layout/responsive-screen";
import { useResponsiveLayout } from "../src/hooks/use-responsive-layout";
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
  waiter: "Waiter"
};

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { padding } = useResponsiveLayout();
  const [authUser, setAuthUser] = useState<User | null>(staffAuth.currentUser);
  const [loading, setLoading] = useState(true);
  const [submittingLogout, setSubmittingLogout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileResult, setProfileResult] = useState<StaffProfileLoadResult | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, width: "100%", backgroundColor: colors.background },
        inner: { width: "100%" },
        centered: {
          flex: 1,
          width: "100%",
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: padding
        },
        stateTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, marginBottom: 8 },
        stateText: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: 10, marginBottom: 16 },
        top: { marginBottom: 8 },
        back: { fontSize: 16, fontWeight: "700", color: colors.primary },
        title: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, marginBottom: 20 },
        card: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.border
        },
        badgeRow: { marginBottom: 10, flexDirection: "row" },
        badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
        badgeText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.4 },
        label: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.6 },
        value: { fontSize: 17, fontWeight: "700", color: colors.textPrimary, marginTop: 4 },
        waiterActions: { marginTop: 16, gap: 8 },
        waiterHint: { fontSize: 12, color: colors.textSecondary },
        actionPrimary: {
          marginTop: 18,
          backgroundColor: colors.primary,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: "center"
        },
        actionPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
        actionSecondary: {
          marginTop: 18,
          backgroundColor: colors.hover,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border
        },
        actionSecondaryText: { color: colors.textPrimary, fontWeight: "800", fontSize: 14 },
        logout: {
          marginTop: 14,
          backgroundColor: colors.danger,
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: "center"
        },
        logoutText: { color: "#fff", fontWeight: "800", fontSize: 16 },
        themeSection: { marginTop: 20 }
      }),
    [colors, padding]
  );

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
    const badgeKitchen = { backgroundColor: colors.warning };
    const badgeWaiter = { backgroundColor: colors.info };
    const badgeDefault = { backgroundColor: colors.textDisabled };
    const badgePending = { backgroundColor: colors.textDisabled };
    if (!role) return badgePending;
    if (role === "kitchen") return badgeKitchen;
    if (role === "waiter") return badgeWaiter;
    return badgeDefault;
  }, [role, colors]);

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
        <ActivityIndicator size="large" color={colors.primary} />
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
    <ResponsiveScreen style={{ backgroundColor: colors.background }} scroll contentContainerStyle={{ paddingVertical: padding }}>
      <View style={styles.inner}>
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
        <View style={styles.themeSection}>
          <MobileThemeSwitcher />
        </View>
        {renderRoleAction()}
        <Pressable style={styles.logout} onPress={() => void onLogout()} disabled={submittingLogout}>
          <Text style={styles.logoutText}>{submittingLogout ? "Signing out..." : "Sign out"}</Text>
        </Pressable>
      </View>
    </ResponsiveScreen>
  );
}
