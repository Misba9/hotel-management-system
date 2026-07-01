import { ManagerTablesScreen } from "../../src/features/manager-mobile/screens";
import { ManagerModuleProvider } from "../../src/features/manager-mobile/manager-module-context";

export default function ManagerTablesPage() {
  return (
    <ManagerModuleProvider>
      <ManagerTablesScreen />
    </ManagerModuleProvider>
  );
}
