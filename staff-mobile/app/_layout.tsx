import "expo-dev-client";
import "react-native-gesture-handler";
import NetInfo from "@react-native-community/netinfo";
import { Stack, usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { installGlobalErrorHandlers } from "../src/bootstrap-global-errors";
import { ensureStaffFirestoreOnline } from "../src/services/firebase";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MobileThemeProvider } from "../../shared/theme/react-native/MobileThemeProvider";
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
    return init();
  }, [init]);

  /** Centralized auth + role routing with loop guard. */
  useEffect(() => {
    if (!nav?.key) return;
    if (!authReady || loading) return;
    const root = pathname.split("/")[1] || undefined;

    if (!user) {
      if (pathname !== "/login") router.replace("/login");
      return;
    }

    if (!isAuthenticated || !role) {
      if (pathname !== "/login") router.replace("/login");
      return;
    }

    const roleHome = String(roleHomeHref(role));
    if (root === "login" || root === "index" || root === undefined || root === "") {
      if (pathname !== roleHome) router.replace(roleHome as never);
      return;
    }

    const prefix = roleRoutePrefix(role);
    if (root !== prefix && !isGlobalStaffRouteRoot(root)) {
      if (pathname !== roleHome) router.replace(roleHome as never);
    }
  }, [nav?.key, authReady, loading, user, isAuthenticated, role, pathname, router]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <MobileThemeProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <OfflineBanner />
          <StaffNotificationBootstrap />
        </MobileThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }
});
