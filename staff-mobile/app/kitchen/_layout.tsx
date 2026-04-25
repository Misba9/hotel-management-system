import { Tabs } from "expo-router";

import { ProfileNavButton } from "../../components/ProfileNavButton";
import { useRoleShellGuard } from "../../src/hooks/use-role-shell-guard";

export default function KitchenLayout() {
  useRoleShellGuard(["kitchen"]);

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerRight: () => <ProfileNavButton />
      }}
    >
      <Tabs.Screen name="orders" options={{ title: "Orders" }} />
    </Tabs>
  );
}
