import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged, type User } from "firebase/auth";

import { useKitchenAutoPrintSetting } from "../../src/hooks/use-kitchen-auto-print-setting";
import { useResponsiveLayout } from "../../src/hooks/use-responsive-layout";
import { staffAuth } from "../../src/lib/firebase";
import { logout as signOutStaff } from "../../services/auth";
import { subscribeStaffProfile, type StaffProfileLoadResult } from "../../services/staff-profile";

type Props = {
  contentBottomInset?: number;
};

export function KitchenProfilePanel({ contentBottomInset = 0 }: Props) {
  const router = useRouter();
  const { padding } = useResponsiveLayout();
  const { autoPrintEnabled, autoPrintReady, savingAutoPrint, setAutoPrintEnabled } =
    useKitchenAutoPrintSetting();

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
    return subscribeStaffProfile(
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
  }, [authUser]);

  const phoneNumber = useMemo(() => {
    if (!profileResult?.ok) return authUser?.phoneNumber || "Not available";
    return profileResult.profile.phoneNumber?.trim() || authUser?.phoneNumber || "Not available";
  }, [profileResult, authUser]);

  const onLogout = async () => {
    setSubmittingLogout(true);
    try {
      await signOutStaff();
      router.replace("/login");
    } finally {
      setSubmittingLogout(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingHorizontal: padding }]}>
        <ActivityIndicator size="large" color="#ea580c" />
        <Text style={styles.stateText}>Loading profile…</Text>
      </View>
    );
  }

  if (!authUser) {
    return (
      <View style={[styles.centered, { paddingHorizontal: padding }]}>
        <Text style={styles.stateTitle}>Not signed in</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace("/login")}>
          <Text style={styles.primaryBtnText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  if (!profileResult?.ok) {
    return (
      <View style={[styles.centered, { paddingHorizontal: padding }]}>
        <Text style={styles.stateTitle}>Profile unavailable</Text>
        <Text style={styles.stateText}>{error ?? profileResult?.reason ?? "Could not load profile."}</Text>
        <Pressable style={styles.logoutBtn} onPress={() => void onLogout()} disabled={submittingLogout}>
          <Text style={styles.logoutText}>{submittingLogout ? "Signing out…" : "Sign out"}</Text>
        </Pressable>
      </View>
    );
  }

  const profile = profileResult.profile;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        { paddingHorizontal: padding, paddingBottom: contentBottomInset + 24 }
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionHeading}>Profile</Text>
      <View style={styles.card}>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>Kitchen</Text>
        </View>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{profile.name}</Text>
        <Text style={[styles.label, styles.labelGap]}>Phone</Text>
        <Text style={styles.value}>{phoneNumber}</Text>
        <Text style={[styles.label, styles.labelGap]}>Email</Text>
        <Text style={styles.value}>{profile.email || authUser.email || "Not available"}</Text>
      </View>

      <Text style={[styles.sectionHeading, styles.sectionGap]}>Settings</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>Auto-print KOT</Text>
            <Text style={styles.settingHint}>
              When on, new kitchen tickets print automatically.
            </Text>
          </View>
          {!autoPrintReady ? (
            <ActivityIndicator color="#ea580c" />
          ) : (
            <Switch
              value={autoPrintEnabled}
              disabled={savingAutoPrint}
              onValueChange={(value) => void setAutoPrintEnabled(value)}
              trackColor={{ false: "#475569", true: "#fdba74" }}
              thumbColor={autoPrintEnabled ? "#ea580c" : "#cbd5e1"}
            />
          )}
        </View>
        <Text style={styles.settingStatus}>
          {autoPrintEnabled ? "Auto-print is ON" : "Auto-print is OFF"}
        </Text>
      </View>

      <Pressable style={styles.logoutBtn} onPress={() => void onLogout()} disabled={submittingLogout}>
        <Text style={styles.logoutText}>{submittingLogout ? "Signing out…" : "Sign out"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  scroll: {
    paddingTop: 4,
    width: "100%"
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#e2e8f0",
    marginBottom: 10
  },
  sectionGap: { marginTop: 18 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 16,
    width: "100%"
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ea580c",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12
  },
  roleBadgeText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.4 },
  label: { fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.4 },
  labelGap: { marginTop: 14 },
  value: { fontSize: 16, fontWeight: "700", color: "#f8fafc", marginTop: 4 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingCopy: { flex: 1, minWidth: 0 },
  settingLabel: { fontSize: 15, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  settingHint: { fontSize: 12, color: "#94a3b8", lineHeight: 17 },
  settingStatus: { marginTop: 12, fontSize: 12, fontWeight: "700", color: "#fdba74" },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: "#ea580c",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  logoutBtn: {
    marginTop: 20,
    backgroundColor: "#b91c1c",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center"
  },
  logoutText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  stateTitle: { fontSize: 20, fontWeight: "800", color: "#f8fafc" },
  stateText: { fontSize: 14, color: "#94a3b8", textAlign: "center", lineHeight: 20 }
});
