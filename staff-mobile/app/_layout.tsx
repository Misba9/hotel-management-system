import "react-native-gesture-handler";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import { installGlobalErrorHandlers } from "../src/bootstrap-global-errors";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { StaffNotificationBootstrap } from "../src/components/staff-notification-bootstrap";
import { OfflineBanner } from "../src/components/ux/offline-banner";
import { roleHomeHref, roleRoutePrefix } from "../src/lib/staff-role-home";
import { useAuthStore } from "../store/useAuthStore";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const authReady = useAuthStore((s) => s.authReady);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  const router = useRouter();
  const segments = useSegments();
  const nav = useRootNavigationState();

  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  useEffect(() => {
    return init();
  }, [init]);

  /** Centralized auth + role routing (Expo Router only). */
  useEffect(() => {
    if (!nav?.key) return;
    if (!authReady || loading) return;

    const root = segments[0] as string | undefined;

    if (!user) {
      if (root !== "login" && root !== "index") {
        router.replace("/login");
      }
      return;
    }

    if (!isAuthenticated || !role) {
      if (root !== "login") {
        router.replace("/login");
      }
      return;
    }

    if (root === "profile") {
      return;
    }

    if (root === "login" || root === "index" || root === undefined) {
      router.replace(roleHomeHref(role));
      return;
    }

    const prefix = roleRoutePrefix(role);
    if (root !== prefix) {
      router.replace(roleHomeHref(role));
    }
  }, [nav?.key, authReady, loading, user, isAuthenticated, role, segments, router]);

  return (
    <SafeAreaProvider>
      {(!authReady || loading) && (
        <View style={styles.boot} pointerEvents="auto">
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }} />
      <OfflineBanner />
      <StaffNotificationBootstrap />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    zIndex: 50
  }
});
