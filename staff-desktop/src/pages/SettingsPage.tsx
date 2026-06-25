import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DesktopAppShell } from "@/components/DesktopAppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { getDesktopApi, isDesktopRuntime } from "@/lib/desktop-api";
import type { PrinterDevice, StaffDesktopSettings } from "../../electron/main-types";

const cardClass = "theme-card-elevated rounded-2xl p-5";
const labelClass = "mt-4 block text-sm font-semibold text-theme-text-primary";
const inputClass =
  "theme-input mt-1 h-11 w-full rounded-xl border border-theme-border bg-theme-input-bg px-4 text-sm text-theme-text-primary outline-none focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/20";
const sectionTitleClass = "text-base font-bold text-theme-text-primary";

export function SettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { status, syncNow } = useOfflineSync();
  const [settings, setSettings] = useState<StaffDesktopSettings | null>(null);
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    void (async () => {
      const api = getDesktopApi();
      const [nextSettings, deviceList] = await Promise.all([api.getSettings(), api.listPrinters()]);
      setSettings(nextSettings);
      setPrinters(deviceList);
    })();
  }, []);

  if (!isDesktopRuntime()) {
    return (
      <DesktopAppShell title="Settings" onLogout={() => void logout()}>
        <div className="flex h-full items-center justify-center p-6 text-sm text-theme-text-secondary">
          Desktop settings are only available in the Electron app.
        </div>
      </DesktopAppShell>
    );
  }

  if (!settings) {
    return (
      <DesktopAppShell title="Settings" onLogout={() => void logout()}>
        <div className="flex h-full items-center justify-center p-6 text-sm text-theme-text-secondary">
          Loading settings…
        </div>
      </DesktopAppShell>
    );
  }

  const save = async (partial: Partial<StaffDesktopSettings>) => {
    setSaving(true);
    try {
      const next = await getDesktopApi().saveSettings(partial);
      setSettings(next);
      setMessage("Settings saved");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await save(settings);
  };

  const refreshPrinters = async () => {
    const deviceList = await getDesktopApi().listPrinters();
    setPrinters(deviceList);
    setMessage(`Found ${deviceList.length} printer device(s)`);
  };

  return (
    <DesktopAppShell title="Desktop Settings" onLogout={() => void logout()}>
      <div className="h-full overflow-y-auto bg-theme-background p-6">
        <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-3xl space-y-6">
          {message ? (
            <p className="rounded-lg border border-theme-success/30 bg-theme-success-muted px-4 py-3 text-sm text-theme-success">
              {message}
            </p>
          ) : null}

          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={sectionTitleClass}>Printers</h2>
              <button
                type="button"
                onClick={() => void refreshPrinters()}
                className="rounded-lg border border-theme-border bg-theme-hover px-3 py-2 text-xs font-bold text-theme-text-secondary transition hover:border-theme-primary/40 hover:text-theme-text-primary"
              >
                Scan USB devices
              </button>
            </div>

            <label className={labelClass}>
              Counter / Invoice printer
              <select
                value={settings.counterPrinterInterface ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    counterPrinterInterface: e.target.value || null
                  })
                }
                className={inputClass}
              >
                <option value="">Auto-detect first USB printer</option>
                {printers.map((device) => (
                  <option key={device.path} value={device.path}>
                    {device.path}
                    {device.manufacturer ? ` · ${device.manufacturer}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Kitchen / KOT printer
              <select
                value={settings.kitchenPrinterInterface ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    kitchenPrinterInterface: e.target.value || null
                  })
                }
                className={inputClass}
              >
                <option value="">Auto-detect first USB printer</option>
                {printers.map((device) => (
                  <option key={`kitchen-${device.path}`} value={device.path}>
                    {device.path}
                    {device.manufacturer ? ` · ${device.manufacturer}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className={cardClass}>
            <h2 className={sectionTitleClass}>Desktop behavior</h2>
            <div className="mt-4 space-y-3">
              <ToggleRow
                label="Fullscreen mode"
                checked={settings.fullscreen}
                onChange={(checked) => setSettings({ ...settings, fullscreen: checked })}
              />
              <ToggleRow
                label="Launch on Windows startup"
                checked={settings.autoLaunch}
                onChange={(checked) => setSettings({ ...settings, autoLaunch: checked })}
              />
              <ToggleRow
                label="Sound notifications for new orders"
                checked={settings.soundNotifications}
                onChange={(checked) => setSettings({ ...settings, soundNotifications: checked })}
              />
            </div>
          </section>

          <section className={cardClass}>
            <h2 className={sectionTitleClass}>Offline sync</h2>
            <p className="mt-2 text-sm text-theme-text-secondary">
              <span className={status.online ? "text-theme-success" : "text-theme-warning"}>
                {status.online ? "Online" : "Offline"}
              </span>
              {" · "}
              {status.pendingCount} queued order(s)
            </p>
            {status.lastSyncAt ? (
              <p className="mt-1 text-xs text-theme-text-disabled">
                Last sync: {new Date(status.lastSyncAt).toLocaleString()}
              </p>
            ) : null}
            {status.lastError ? (
              <p className="mt-1 text-xs text-theme-danger">Last error: {status.lastError}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void syncNow()}
              className="mt-3 rounded-lg bg-theme-primary px-4 py-2 text-xs font-bold text-white shadow-glow-sm transition hover:brightness-110"
            >
              Sync queued orders now
            </button>
          </section>

          <div className="flex flex-wrap gap-3 pb-6">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-xl bg-theme-primary px-6 text-sm font-bold text-white shadow-glow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
            <button
              type="button"
              onClick={() => void getDesktopApi().toggleFullscreen()}
              className="min-h-[44px] rounded-xl border border-theme-border bg-theme-hover px-6 text-sm font-bold text-theme-text-primary transition hover:border-theme-primary/40"
            >
              Toggle fullscreen
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="min-h-[44px] rounded-xl border border-theme-border bg-theme-hover px-6 text-sm font-bold text-theme-text-primary transition hover:border-theme-primary/40"
            >
              Back
            </button>
          </div>
        </form>
      </div>
    </DesktopAppShell>
  );
}

function ToggleRow({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 rounded-xl border border-theme-border bg-theme-hover/50 px-4 py-3 transition hover:border-theme-primary/30">
      <span className="text-sm font-semibold text-theme-text-primary">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 cursor-pointer accent-[var(--theme-primary)]"
      />
    </label>
  );
}
