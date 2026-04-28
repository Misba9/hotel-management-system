import "react-native-gesture-handler";
import NetInfo from "@react-native-community/netinfo";
import { Stack, usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { installGlobalErrorHandlers } from "../src/bootstrap-global-errors";
import { ensureStaffFirestoreOnline } from "../src/services/firebase";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { StaffNotificationBootstrap } from "../src/components/staff-notification-bootstrap";
import { OfflineBanner } from "../src/components/ux/offline-banner";
import { isGlobalStaffRouteRoot, roleHomeHref, roleRoutePrefix } from "../src/lib/staff-role-home";
import { useAuthStore } from "../store/useAuthStore";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const authReady = useAuthStore((s) => s.authReady);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  const router = useRouter();
  const pathname = usePathname();
  const nav = useRootNavigationState();
  const didInitAuthRef = useRef(false);
  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  /** Re-enable Firestore network transport after offline / flaky RPC (WebChannel Listen errors). */
  useEffect(() => {
    void ensureStaffFirestoreOnline();
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) void ensureStaffFirestoreOnline();
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (didInitAuthRef.current) return;
    didInitAuthRef.current = true;
    return init();
  }, [init]);

  /** Centralized auth + role routing with loop guard. */
  useEffect(() => {
    if (!nav?.key) return;
    if (!authReady || loading) return;
    const root = pathname.split("/")[1] || undefined;
    const redirectTo = (target: string) => {
      if (pathname === target) return;
      if (lastRedirectRef.current === target) return;
      lastRedirectRef.current = target;
      router.replace(target as never);
    };

    if (!user) {
      redirectTo("/login");
      return;
    }

    if (!isAuthenticated || !role) {
      redirectTo("/login");
      return;
    }

    const roleHome = String(roleHomeHref(role));
    if (root === "login" || root === "index" || root === undefined || root === "") {
      redirectTo(roleHome);
      return;
    }

    const prefix = roleRoutePrefix(role);
    if (root !== prefix && !isGlobalStaffRouteRoot(root)) {
      redirectTo(roleHome);
      return;
    }

    lastRedirectRef.current = null;
  }, [nav?.key, authReady, loading, user, isAuthenticated, role, pathname, router]);

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
