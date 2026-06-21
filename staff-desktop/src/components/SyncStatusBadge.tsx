import { useAuth } from "@/contexts/AuthContext";
import { useCloudConnection } from "@/contexts/CloudConnectionContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import type { OfflineSyncStatus } from "../../electron/main-types";

type SyncStatusBadgeProps = {
  status?: OfflineSyncStatus;
};

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const { online, connectionState, realtimeReady } = useCloudConnection();
  const offlineStatus = status;

  const pendingCount = offlineStatus?.pendingCount ?? 0;
  const syncing = offlineStatus?.syncing ?? false;

  const label = syncing
    ? "Syncing…"
    : !online
      ? pendingCount > 0
        ? `Offline · ${pendingCount} queued`
        : "Offline"
      : connectionState === "connected" && realtimeReady
        ? pendingCount > 0
          ? `Online · ${pendingCount} pending sync`
          : "Online · Connected"
        : connectionState === "connecting" || connectionState === "reconnecting"
          ? "Connecting…"
          : "Online";

  const tone = !online
    ? "bg-orange-100 text-orange-700 ring-orange-300"
    : pendingCount > 0
      ? "bg-amber-100 text-amber-700 ring-amber-300"
      : connectionState === "connected" && realtimeReady
        ? "bg-emerald-100 text-emerald-700 ring-emerald-300"
        : "bg-sky-100 text-sky-700 ring-sky-300";

  return (
    <span
      className={`inline-flex min-h-[36px] items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-2 ${tone}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          !online ? "bg-orange-500" : pendingCount > 0 ? "bg-amber-500" : "bg-emerald-500"
        }`}
      />
      {label}
    </span>
  );
}

export function RoleBadge() {
  const { role } = useAuth();
  if (!role) return null;
  const labels: Record<string, string> = {
    cashier: "Cashier",
    kitchen: "Kitchen",
    waiter: "Waiter",
    manager: "Manager",
    admin: "Admin",
    delivery: "Delivery"
  };
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
      {labels[role] ?? role}
    </span>
  );
}
