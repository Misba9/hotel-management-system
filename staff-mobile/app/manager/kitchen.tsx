import { ManagerKitchenScreen } from "../../src/features/manager-mobile/screens";
import { ManagerModuleProvider } from "../../src/features/manager-mobile/manager-module-context";

export default function ManagerKitchenPage() {
  return (
    <ManagerModuleProvider>
      <ManagerKitchenScreen />
    </ManagerModuleProvider>
  );
}
