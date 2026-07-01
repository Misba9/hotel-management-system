import { ManagerMoreScreen } from "../../src/features/manager-mobile/screens";
import { ManagerModuleProvider } from "../../src/features/manager-mobile/manager-module-context";

export default function ManagerMorePage() {
  return (
    <ManagerModuleProvider>
      <ManagerMoreScreen />
    </ManagerModuleProvider>
  );
}
