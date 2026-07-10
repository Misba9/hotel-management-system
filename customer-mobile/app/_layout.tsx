import "react-native-gesture-handler";
import NetInfo from "@react-native-community/netinfo";
import { Stack, usePathname, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MobileThemeProvider } from "../../shared/theme/react-native/MobileThemeProvider";
import { AppProviders } from "@/src/providers/app-providers";
import { ErrorBoundary } from "@/src/components/ui/error-boundary";
import { FcmBootstrap } from "@/src/components/fcm-bootstrap";
import { OfflineBanner } from "@/src/components/layout/offline-banner";
import { ToastOverlay } from "@/src/components/layout/toast-overlay";
import { useAuth } from "@/src/context/auth-context";
import { ensureFirestoreOnline } from "@/src/services/firebase";

SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { authReady, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const nav = useRootNavigationState();

  useEffect(() => {
    if (!authReady) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [authReady]);

  useEffect(() => {
    if (!nav?.key || !authReady) return;

    const inAuthGroup = segments[0] === "auth" || pathname === "/";
    const isSplash = pathname === "/";

    if (isSplash) return;

    if (!isAuthenticated && !inAuthGroup) {
      // Allow Firebase debug without login while diagnosing OTP / network issues.
      if (pathname === "/firebase-debug") return;
      router.replace("/auth/login");
      return;
    }

    if (isAuthenticated && inAuthGroup && pathname !== "/") {
      router.replace("/(tabs)/home");
    }
  }, [authReady, isAuthenticated, nav?.key, pathname, router, segments]);

  if (!authReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#4F8CFF" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    void ensureFirestoreOnline();
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) void ensureFirestoreOnline();
    });
    return () => unsub();
  }, []);

  return (
    <SafeAreaProvider>
      <MobileThemeProvider>
        <ErrorBoundary>
          <AppProviders>
            <AuthGate>
              <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="product/[id]" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="categories" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="wishlist" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="checkout" options={{ animation: "slide_from_bottom" }} />
                <Stack.Screen name="order-success" options={{ animation: "fade" }} />
                <Stack.Screen name="order-tracking" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="coupons" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="addresses" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="help" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="firebase-debug" options={{ animation: "slide_from_right" }} />
              </Stack>
              <OfflineBanner />
              <FcmBootstrap />
              <ToastOverlay />
            </AuthGate>
          </AppProviders>
        </ErrorBoundary>
      </MobileThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F1115",
    zIndex: 50
  }
});
