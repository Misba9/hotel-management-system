import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthProvider";
import LoginScreen from "../screens/LoginScreen";
import ManagerScreen from "../screens/ManagerScreen";
import CashierScreen from "../screens/CashierScreen";
import KitchenScreen from "../screens/KitchenScreen";
import DeliveryScreen from "../screens/DeliveryScreen";
import { AdminDashboardScreen } from "../screens/admin-dashboard-screen";
import { WaiterScreen } from "../screens/waiter-screen";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { PendingApprovalScreen } from "../screens/pending-approval-screen";
import { InactiveAccountScreen } from "../screens/inactive-account-screen";
import { SyncErrorScreen } from "../screens/sync-error-screen";
import { rootRouteForStaffRole } from "./staff-role-routes";

const Stack = createNativeStackNavigator();

function SignOutHeaderButton() {
  const { signOutUser } = useAuth();
  return (
    <Text onPress={() => void signOutUser()} style={{ marginRight: 16, color: "#FF6B35", fontWeight: "600" }}>
      Sign out
    </Text>
  );
}

/**
 * Auth → auto `staff_users/{uid}` → gate: pending | active | paused | sync_error (no “access denied” for missing docs).
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

  if (gate === "pending" || gate === "needs_assignment") {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Pending" component={PendingApprovalScreen} options={{ title: "Waiting for approval" }} />
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

  const route = rootRouteForStaffRole(staff.role);
  const headerRight = () => <SignOutHeaderButton />;

  return (
    <Stack.Navigator screenOptions={{ gestureEnabled: false, headerBackVisible: false }}>
      {route === "AdminRoot" ? (
        <Stack.Screen name="AdminRoot" component={AdminDashboardScreen} options={{ title: "Admin", headerRight }} />
      ) : route === "ManagerRoot" ? (
        <Stack.Screen name="ManagerRoot" component={ManagerScreen} options={{ headerShown: false }} />
      ) : route === "CashierRoot" ? (
        <Stack.Screen name="CashierRoot" component={CashierScreen} options={{ headerShown: false }} />
      ) : route === "KitchenRoot" ? (
        <Stack.Screen name="KitchenRoot" component={KitchenScreen} options={{ headerShown: false }} />
      ) : route === "DeliveryRoot" ? (
        <Stack.Screen name="DeliveryRoot" component={DeliveryScreen} options={{ headerShown: false }} />
      ) : route === "WaiterRoot" ? (
        <Stack.Screen name="WaiterRoot" component={WaiterScreen} options={{ title: "Waiter", headerRight }} />
      ) : (
        <Stack.Screen name="Fallback" options={{ title: "Staff" }}>
          {() => (
            <View style={styles.fallback}>
              <Text style={styles.fallbackText}>No route for this role.</Text>
            </View>
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF8F3", padding: 24 },
  fallbackText: { color: "#64748b", fontSize: 16 }
});
