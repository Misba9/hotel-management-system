import { Tabs } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { ProfileNavButton } from "../../components/ProfileNavButton";
import { useRoleShellGuard } from "../../src/hooks/use-role-shell-guard";

const MANAGER_SHELL_ALLOWED = ["manager", "admin"] as const;

function ManagerTabs() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerRight: () => <ProfileNavButton />
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={(focused ? "view-dashboard" : "view-dashboard-outline") as any}
              size={size}
              color={color}
            />
          )
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={(focused ? "clipboard-list" : "clipboard-list-outline") as any}
              size={size}
              color={color}
            />
          )
        }}
      />
      <Tabs.Screen
        name="tables"
        options={{
          title: "Tables",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={"table-furniture" as any} size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: "Kitchen",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={"chef-hat" as any} size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={(focused ? "dots-horizontal-circle" : "dots-horizontal-circle-outline") as any}
              size={size}
              color={color}
            />
          )
        }}
      />
      <Tabs.Screen name="staff" options={{ href: null, title: "Staff" }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: "Notifications" }} />
      <Tabs.Screen name="reports" options={{ href: null, title: "Reports" }} />
    </Tabs>
  );
}

export default function ManagerLayout() {
  useRoleShellGuard(MANAGER_SHELL_ALLOWED);

  return <ManagerTabs />;
}
