import { ManagerReportsScreen } from "../../src/features/manager-mobile/screens";
import { ManagerModuleProvider } from "../../src/features/manager-mobile/manager-module-context";

export default function ManagerReportsPage() {
  return (
    <ManagerModuleProvider>
      <ManagerReportsScreen />
    </ManagerModuleProvider>
  );
}
