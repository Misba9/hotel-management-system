import { ManagerDashboardScreen } from "../../src/features/manager-mobile/screens";
import { ManagerModuleProvider } from "../../src/features/manager-mobile/manager-module-context";

export default function ManagerDashboardPage() {
  return (
    <ManagerModuleProvider>
      <ManagerDashboardScreen />
    </ManagerModuleProvider>
  );
}
