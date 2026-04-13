import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthProvider";
import LoginScreen from "../screens/LoginScreen";
import AdminScreen from "../screens/AdminScreen";
import ManagerScreen from "../screens/ManagerScreen";
import CashierScreen from "../screens/CashierScreen";
import KitchenScreen from "../screens/KitchenScreen";
import DeliveryScreen from "../screens/DeliveryScreen";
import { WaiterStackNavigator } from "./waiter-stack-navigator";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { PendingApprovalScreen } from "../screens/pending-approval-screen";
import { InactiveAccountScreen } from "../screens/inactive-account-screen";
import { SyncErrorScreen } from "../screens/sync-error-screen";
import { isPendingApprovalGate, rootRouteForStaffRole } from "./staff-role-routes";

const Stack = createNativeStackNavigator();

/** Approved, active staff → single root screen per role (see {@link rootRouteForStaffRole}). */
const STAFF_ROOT_COMPONENTS = {
  AdminRoot: AdminScreen,
  ManagerRoot: ManagerScreen,
  CashierRoot: CashierScreen,
  KitchenRoot: KitchenScreen,
  DeliveryRoot: DeliveryScreen,
  WaiterDashboard: WaiterStackNavigator
};

/**
 * Auth → approval (`users` + `staff_users`) → role-based root:
 * admin → AdminDashboard · manager → ManagerDashboard · kitchen / cashier / delivery / waiter → role screens.
 */
export function AppNavigator() {
  const { user, staff, loading, gate } = useAuth();

  if (loading) {
    return <StaffLoadingView message="Loading your role and permissions…" />;
  }

  if (!user) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Staff login" }} />
      </Stack.Navigator>
    );
  }

  if (isPendingApprovalGate(gate)) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Pending" component={PendingApprovalScreen} options={{ title: "Pending approval" }} />
      </Stack.Navigator>
    );
  }

  if (gate === "paused") {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Inactive" component={InactiveAccountScreen} options={{ title: "Account" }} />
      </Stack.Navigator>
    );
  }

  if (gate === "sync_error") {
    return (
      <Stack.Navigator>
        <Stack.Screen name="SyncError" component={SyncErrorScreen} options={{ title: "Sync" }} />
      </Stack.Navigator>
    );
  }

  if (gate !== "active" || !staff) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Loading" options={{ title: "…" }}>
          {() => (
            <View style={styles.fallback}>
              <Text style={styles.fallbackText}>Loading profile…</Text>
            </View>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  const routeKey = rootRouteForStaffRole(staff.role);
  const RootComponent = STAFF_ROOT_COMPONENTS[routeKey];
  /** Remount root stack when role (or user) changes so nested navigators reset (realtime `users/{uid}` updates). */
  const rootNavigatorKey = `${user.uid}-${routeKey}`;

  if (!RootComponent) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="UnknownRole" options={{ title: "Staff" }}>
          {() => (
            <View style={styles.fallback}>
              <Text style={styles.fallbackText}>No home screen for role: {String(staff.role)}</Text>
            </View>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      key={rootNavigatorKey}
      screenOptions={{ gestureEnabled: false, headerBackVisible: false }}
    >
      <Stack.Screen name={routeKey} component={RootComponent} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF8F3", padding: 24 },
  fallbackText: { color: "#64748b", fontSize: 16 }
});
