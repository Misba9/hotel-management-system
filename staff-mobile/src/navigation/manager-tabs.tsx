import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, TouchableOpacity, View } from "react-native";
import { useStaffAuth } from "../context/staff-auth-context";
import { hasPermission } from "../lib/rbac";
import { ManagerDashboardScreen } from "../screens/manager/manager-dashboard-screen";
import { ManagerOrdersScreen } from "../screens/manager/manager-orders-screen";
import { ManagerAnalyticsScreen } from "../screens/manager/manager-analytics-screen";
import { NoAccessView } from "../components/feature-gate";

const Tab = createBottomTabNavigator();

function SignOutTab() {
  const { signOutUser } = useStaffAuth();
  return (
    <TouchableOpacity onPress={() => void signOutUser()} style={{ marginRight: 12 }}>
      <Text style={{ color: "#FF6B35", fontWeight: "700" }}>Sign out</Text>
    </TouchableOpacity>
  );
}

function EmptyManagerArea() {
  return (
    <View style={{ flex: 1, backgroundColor: "#FFF8F3" }}>
      <NoAccessView subtitle="No manager tabs are available for your role." />
    </View>
  );
}

export function ManagerTabsNavigator() {
  const { staff } = useStaffAuth();
  const role = staff?.role;

  const showDashboard = role ? hasPermission(role, "dashboard") : false;
  const showOrders = role ? hasPermission(role, "orders") : false;
  /** Admin: dashboard + orders + analytics. Manager: dashboard + orders only. */
  const showAnalytics =
    role === "admin" || Boolean(role && role !== "manager" && hasPermission(role, "analytics"));

  const anyTab = showDashboard || showOrders || showAnalytics;

  const headerTitle = role === "admin" ? "Admin" : "Manager";

  if (!anyTab) {
    return (
      <Tab.Navigator screenOptions={{ tabBarActiveTintColor: "#FF6B35", headerRight: () => <SignOutTab /> }}>
        <Tab.Screen name="Home" component={EmptyManagerArea} options={{ title: headerTitle }} />
      </Tab.Navigator>
    );
  }

  const initial =
    showDashboard ? "Dashboard" : showOrders ? "Orders" : "Analytics";

  return (
    <Tab.Navigator
      initialRouteName={initial}
      screenOptions={{
        tabBarActiveTintColor: "#FF6B35",
        headerTitle,
        headerRight: () => <SignOutTab />
      }}
    >
      {showDashboard ? <Tab.Screen name="Dashboard" component={ManagerDashboardScreen} /> : null}
      {showOrders ? <Tab.Screen name="Orders" component={ManagerOrdersScreen} /> : null}
      {showAnalytics ? <Tab.Screen name="Analytics" component={ManagerAnalyticsScreen} /> : null}
    </Tab.Navigator>
  );
}
