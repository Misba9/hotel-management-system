import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider } from "./src/context/AuthProvider";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { StaffRealtimeBanner } from "./src/components/staff-realtime-banner";
import { StaffNotificationBootstrap } from "./src/components/staff-notification-bootstrap";
import { OfflineBanner } from "./src/components/ux/offline-banner";
import { AppErrorBoundary } from "./src/components/app-error-boundary";
import { installGlobalErrorHandlers } from "./src/bootstrap-global-errors";

/** @deprecated Prefer importing from `src/navigation/AppNavigator` if you add a typed param list module. */
export type RootStackParamList = {
  Login: undefined;
  AdminRoot: undefined;
  ManagerRoot: undefined;
  CashierRoot: undefined;
  KitchenRoot: undefined;
  DeliveryRoot: undefined;
  WaiterDashboard: undefined;
};

export default function App() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AuthProvider>
          <View style={styles.root}>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
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
