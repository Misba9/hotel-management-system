import { Tabs } from "expo-router";

import { ProfileNavButton } from "../../components/ProfileNavButton";
import { useRoleShellGuard } from "../../src/hooks/use-role-shell-guard";

export default function CashierLayout() {
  useRoleShellGuard(["cashier"]);

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerRight: () => <ProfileNavButton />
      }}
    >
      <Tabs.Screen name="billing" options={{ title: "Billing" }} />
      <Tabs.Screen name="walk-in" options={{ title: "Walk-in" }} />
    </Tabs>
  );
}
