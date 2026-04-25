import { Stack } from "expo-router";

import { ProfileNavButton } from "../../components/ProfileNavButton";
import { useRoleShellGuard } from "../../src/hooks/use-role-shell-guard";

export default function DeliveryLayout() {
  useRoleShellGuard(["delivery"]);

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerRight: () => <ProfileNavButton />
      }}
    >
      <Stack.Screen name="deliveries" options={{ title: "Delivery", headerShown: false }} />
      <Stack.Screen name="[deliveryId]" options={{ title: "Delivery", headerBackTitle: "List" }} />
    </Stack>
  );
}
