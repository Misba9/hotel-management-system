import Constants from "expo-constants";
import { getApps } from "firebase/app";
import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { getApiBaseUrl } from "@/src/lib/api";
import { auth } from "@/src/lib/firebase";
import { firebaseApp } from "@/src/services/firebase";

type Row = { label: string; value: string; ok?: boolean };

/**
 * Temporary Firebase / device diagnostics for OTP troubleshooting.
 * Open from Profile → "Firebase debug" or /firebase-debug.
 */
export default function FirebaseDebugScreen() {
  const colors = useThemeColors();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    void (async () => {
      const next: Row[] = [];
      const apps = getApps();
      next.push({
        label: "Firebase initialized",
        value: apps.length > 0 ? `yes (${apps.length} app)` : "NO",
        ok: apps.length > 0
      });
      next.push({
        label: "Firebase app name",
        value: firebaseApp?.name ?? "(none)",
        ok: Boolean(firebaseApp?.name)
      });
      next.push({
        label: "Project ID",
        value: firebaseApp?.options?.projectId ?? "(missing)",
        ok: Boolean(firebaseApp?.options?.projectId)
      });
      next.push({
        label: "App ID",
        value: String(firebaseApp?.options?.appId ?? "(missing)"),
        ok: Boolean(firebaseApp?.options?.appId)
      });
      next.push({
        label: "API key present",
        value: firebaseApp?.options?.apiKey ? "yes" : "NO",
        ok: Boolean(firebaseApp?.options?.apiKey)
      });
      next.push({
        label: "Auth instance",
        value: auth ? `ready (user=${auth.currentUser?.uid ?? "signed-out"})` : "missing",
        ok: Boolean(auth)
      });

      const net = await NetInfo.fetch();
      next.push({
        label: "Internet",
        value: `${net.isConnected ? "connected" : "offline"} / ${net.type}`,
        ok: Boolean(net.isConnected)
      });

      next.push({
        label: "API base URL",
        value: getApiBaseUrl(),
        ok: !/localhost|127\.0\.0\.1/i.test(getApiBaseUrl()) || Platform.OS === "web"
      });

      next.push({
        label: "Platform",
        value: `${Platform.OS} ${String(Platform.Version)}`
      });
      next.push({
        label: "Expo app ownership",
        value: String(Constants.appOwnership ?? "unknown")
      });
      next.push({
        label: "Expo hostUri",
        value: String(Constants.expoConfig?.hostUri ?? Constants.linkingUri ?? "(none)")
      });

      const androidPkg =
        Constants.expoConfig?.android?.package ??
        (Constants as { androidId?: string }).androidId ??
        "(see app.json)";
      next.push({
        label: "Android package (config)",
        value: String(androidPkg)
      });
      next.push({
        label: "Expected package",
        value: "com.hotel.customermobile",
        ok: true
      });

      next.push({
        label: "Google Play Services",
        value:
          Platform.OS === "android"
            ? "Assume available on stock devices (not queried in Expo Go)"
            : "n/a"
      });
      next.push({
        label: "SHA fingerprints",
        value:
          "Run: cd android && ./gradlew signingReport — add SHA-1/SHA-256 in Firebase Console"
      });

      next.push({
        label: "OTP implementation",
        value: "Server Twilio SMS/WhatsApp via customer-web API (not RN Firebase Phone Auth)"
      });
      next.push({
        label: "@react-native-firebase/*",
        value: "Not installed (using firebase JS SDK + REST OTP) — OK for Expo Go"
      });

      setRows(next);
    })();
  }, []);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Firebase debug" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Temporary diagnostics. Remove this screen before production release.
        </Text>
        {rows.map((r) => (
          <View
            key={r.label}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>{r.label}</Text>
            <Text
              style={[
                styles.value,
                {
                  color:
                    r.ok === false ? colors.danger : r.ok === true ? colors.success : colors.textPrimary
                }
              ]}
            >
              {r.value}
            </Text>
          </View>
        ))}

        <Text style={[styles.checklistTitle, { color: colors.textPrimary }]}>
          Firebase Console checklist
        </Text>
        {[
          "Phone Authentication enabled (Authentication → Sign-in method)",
          "SHA-1 added for com.hotel.customermobile",
          "SHA-256 added for com.hotel.customermobile",
          "Package name matches google-services.json",
          "Latest google-services.json downloaded into android/app/",
          "Rebuilt Android app after replacing google-services.json",
          "customer-web running + TWILIO_* env set for SMS OTP",
          "EXPO_PUBLIC_API_BASE_URL reachable from the phone (not localhost)"
        ].map((item) => (
          <Text key={item} style={[styles.check, { color: colors.textSecondary }]}>
            ✓ {item}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: 16, paddingBottom: 48 },
  note: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10
  },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  value: { fontSize: 13, lineHeight: 18 },
  checklistTitle: { fontSize: 16, fontWeight: "800", marginTop: 20, marginBottom: 10 },
  check: { fontSize: 13, lineHeight: 20, marginBottom: 6 }
});
