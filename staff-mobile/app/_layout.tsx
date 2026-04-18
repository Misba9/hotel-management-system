import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthProvider";
import { StaffRealtimeBanner } from "../src/components/staff-realtime-banner";
import { StaffNotificationBootstrap } from "../src/components/staff-notification-bootstrap";
import { OfflineBanner } from "../src/components/ux/offline-banner";
import { AppErrorBoundary } from "../src/components/app-error-boundary";
import { installGlobalErrorHandlers } from "../src/bootstrap-global-errors";

export default function RootLayout() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AuthProvider>
          <View style={styles.root}>
            <Stack screenOptions={{ headerShown: false }} />
            <OfflineBanner />
            <StaffRealtimeBanner />
            <StaffNotificationBootstrap />
          </View>
        </AuthProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }
});
