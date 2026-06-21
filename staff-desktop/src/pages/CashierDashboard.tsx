import { useCallback, useRef, useState } from "react";
import { CashierPosShell } from "@/components/pos/CashierPosShell";
import { PosDashboard, type PosDashboardHandle } from "@/components/pos/PosDashboard";
import { PosSettingsModal } from "@/components/pos/PosSettingsModal";
import { useAuth } from "@/contexts/AuthContext";
import { getDesktopApi, isDesktopRuntime } from "@/lib/desktop-api";

export function CashierDashboard() {
  const { logout, profile } = useAuth();
  const posRef = useRef<PosDashboardHandle>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    "general" | "printer" | "billing" | "counter" | "kitchen" | "theme" | "shortcuts" | "account"
  >("general");
  const [notificationCount, setNotificationCount] = useState(0);
  const [printerReady, setPrinterReady] = useState(true);

  const openSettings = useCallback(
    (section: "general" | "printer" | "billing" | "counter" | "kitchen" | "theme" | "shortcuts" | "account" = "general") => {
      setSettingsSection(section);
      setShowSettings(true);
    },
    []
  );

  const handlePrinterClick = useCallback(async () => {
    if (isDesktopRuntime()) {
      try {
        const printers = await getDesktopApi().listPrinters();
        setPrinterReady(printers.length > 0);
      } catch {
        setPrinterReady(false);
      }
    }
    openSettings("printer");
  }, [openSettings]);

  return (
    <CashierPosShell
      counterName={profile?.name ? `${profile.name} · Counter` : "Main Counter"}
      notificationCount={notificationCount}
      printerReady={printerReady}
      onNotifications={() => posRef.current?.openNotifications()}
      onShortcuts={() => posRef.current?.openShortcuts()}
      onPrinter={() => void handlePrinterClick()}
      onSettings={() => openSettings("general")}
      onProfile={() => openSettings("account")}
      onLogout={() => void logout()}
    >
      <PosDashboard
        ref={posRef}
        onNotificationCountChange={setNotificationCount}
      />
      <PosSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        initialSection={settingsSection}
        onLogout={() => void logout()}
      />
    </CashierPosShell>
  );
}
