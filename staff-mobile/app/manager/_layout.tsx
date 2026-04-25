import { Tabs } from "expo-router";

import { ProfileNavButton } from "../../components/ProfileNavButton";
import { useRoleShellGuard } from "../../src/hooks/use-role-shell-guard";

export default function ManagerLayout() {
  useRoleShellGuard(["manager", "admin"]);

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerRight: () => <ProfileNavButton />
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
    </Tabs>
  );
}
