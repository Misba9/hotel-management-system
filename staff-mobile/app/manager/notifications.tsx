import { ManagerNotificationsScreen } from "../../src/features/manager-mobile/screens";
import { ManagerModuleProvider } from "../../src/features/manager-mobile/manager-module-context";

export default function ManagerNotificationsPage() {
  return (
    <ManagerModuleProvider>
      <ManagerNotificationsScreen />
    </ManagerModuleProvider>
  );
}
