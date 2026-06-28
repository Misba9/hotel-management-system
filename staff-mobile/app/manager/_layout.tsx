import { Tabs } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { ProfileNavButton } from "../../components/ProfileNavButton";
import { useRoleShellGuard } from "../../src/hooks/use-role-shell-guard";
import { useMobileTheme } from "../../../shared/theme/react-native/MobileThemeProvider";
import { ManagerModuleProvider, useManagerModule } from "../../src/features/manager-mobile/manager-module-context";

function ManagerTabs() {
  const { colors } = useMobileTheme();
  const { orders, kitchenOrders } = useManagerModule();
  const pendingOrders = orders.filter((o) => ["pending", "new"].includes((o.canonicalStatus ?? "").toLowerCase())).length;
  const kitchenQueue = kitchenOrders.length;

  const iconForRoute = (name: string, focused: boolean, color: string, size: number) => {
    const icon =
      name === "dashboard"
        ? focused
          ? "view-dashboard"
          : "view-dashboard-outline"
        : name === "orders"
          ? focused
            ? "clipboard-list"
            : "clipboard-list-outline"
          : name === "tables"
            ? focused
              ? "table-furniture"
              : "table-furniture"
            : name === "kitchen"
              ? focused
                ? "chef-hat"
                : "chef-hat"
              : focused
                ? "dots-horizontal-circle"
                : "dots-horizontal-circle-outline";
    return <MaterialCommunityIcons name={icon as any} size={size} color={color} />;
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerRight: () => <ProfileNavButton />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68,
          paddingTop: 8,
          paddingBottom: 10
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarIcon: ({ color, size, focused }) => iconForRoute(route.name, focused, color, size)
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarBadge: pendingOrders > 0 ? Math.min(99, pendingOrders) : undefined
        }}
      />
      <Tabs.Screen name="tables" options={{ title: "Tables" }} />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: "Kitchen",
          tabBarBadge: kitchenQueue > 0 ? Math.min(99, kitchenQueue) : undefined
        }}
      />
      <Tabs.Screen name="more" options={{ title: "More" }} />
      <Tabs.Screen name="staff" options={{ href: null, title: "Staff" }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: "Notifications" }} />
      <Tabs.Screen name="reports" options={{ href: null, title: "Reports" }} />
    </Tabs>
  );
}

export default function ManagerLayout() {
  useRoleShellGuard(["manager"]);

  return (
    <ManagerModuleProvider>
      <ManagerTabs />
    </ManagerModuleProvider>
  );
}
