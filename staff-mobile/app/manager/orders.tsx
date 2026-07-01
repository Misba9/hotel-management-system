import { ManagerOrdersScreen } from "../../src/features/manager-mobile/screens";
import { ManagerModuleProvider } from "../../src/features/manager-mobile/manager-module-context";

export default function ManagerOrdersPage() {
  return (
    <ManagerModuleProvider>
      <ManagerOrdersScreen />
    </ManagerModuleProvider>
  );
}
