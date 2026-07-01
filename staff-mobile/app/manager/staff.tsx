import { ManagerStaffScreen } from "../../src/features/manager-mobile/screens";
import { ManagerModuleProvider } from "../../src/features/manager-mobile/manager-module-context";

export default function ManagerStaffPage() {
  return (
    <ManagerModuleProvider>
      <ManagerStaffScreen />
    </ManagerModuleProvider>
  );
}
