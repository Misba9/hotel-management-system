import { Stack } from "expo-router";

import { ProfileNavButton } from "../../components/ProfileNavButton";
import { useRoleShellGuard } from "../../src/hooks/use-role-shell-guard";

export default function WaiterLayout() {
  useRoleShellGuard(["waiter"]);

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerRight: () => <ProfileNavButton />
      }}
    >
      <Stack.Screen name="index" options={{ title: "Waiter", headerShown: false }} />
      <Stack.Screen
        name="order/[tableId]"
        options={{
          title: "New order",
          headerBackTitle: "Waiter"
        }}
      />
    </Stack>
  );
}
