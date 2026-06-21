import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCloudConnection } from "@/contexts/CloudConnectionContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";

export type CashierPosShellProps = {
  children: ReactNode;
  counterName?: string;
  notificationCount?: number;
  printerReady?: boolean;
  onNotifications?: () => void;
  onShortcuts?: () => void;
  onPrinter?: () => void;
  onSettings?: () => void;
  onProfile?: () => void;
  onLogout?: () => void;
};

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm tabular-nums text-slate-600 dark:text-slate-300">
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

function UtilityButton({
  label,
  title,
  onClick,
  badge
}: {
  label: string;
  title: string;
  onClick?: () => void;
  badge?: number | string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="relative flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-teal/40 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {label}
      {badge !== undefined && Number(badge) > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function CashierPosShell({
  children,
  counterName = "Main Counter",
  notificationCount = 0,
  printerReady = true,
  onNotifications,
  onShortcuts,
  onPrinter,
  onSettings,
  onProfile,
  onLogout
}: CashierPosShellProps) {
  const { profile } = useAuth();
  const { online, realtimeReady } = useCloudConnection();
  const { status } = useOfflineSync();

  const cloudLabel = online && realtimeReady ? "Online" : online ? "Connecting…" : "Offline";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-slate-900 dark:text-white lg:text-lg">
              Cashier POS
            </h1>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{counterName}</p>
          </div>
          <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
          <LiveClock />
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Shift Open
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              online ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" : "bg-amber-100 text-amber-800"
            }`}
          >
            {cloudLabel}
          </span>
          <SyncStatusBadge status={status} />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <UtilityButton label="🔔" title="Notifications" onClick={onNotifications} badge={notificationCount} />
          <UtilityButton label="⌨" title="Keyboard shortcuts" onClick={onShortcuts} />
          <UtilityButton
            label="🖨"
            title={printerReady ? "Printer ready" : "Printer not configured"}
            onClick={onPrinter}
          />
          <UtilityButton label="⚙" title="Settings" onClick={onSettings} />
          <button
            type="button"
            title="Profile"
            onClick={onProfile}
            className="hidden min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:flex"
          >
            <span>👤</span>
            <span className="max-w-[100px] truncate">{profile?.name ?? "Cashier"}</span>
          </button>
          {onLogout ? (
            <button
              type="button"
              onClick={() => void onLogout()}
              className="min-h-[40px] rounded-lg border-2 border-red-300 px-3 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
            >
              Logout
            </button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
