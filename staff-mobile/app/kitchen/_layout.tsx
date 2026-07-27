import { Tabs } from "expo-router";

import { useRoleShellGuard } from "../../src/hooks/use-role-shell-guard";

export default function KitchenLayout() {
  useRoleShellGuard(["kitchen"]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" }
      }}
    >
      <Tabs.Screen name="orders" options={{ title: "Kitchen" }} />
      <Tabs.Screen name="settings" options={{ href: null, title: "Settings" }} />
    </Tabs>
  );
}
