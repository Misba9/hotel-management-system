import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/modals/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { usePosSettings } from "@/hooks/use-pos-settings";
import { usePrinters } from "@/hooks/use-printers";
import { getDesktopApi, isDesktopRuntime } from "@/lib/desktop-api";
import { roleLabel } from "@/lib/role-routes";
import type { PrinterDevice, StaffDesktopSettings } from "../../../electron/main-types";

type SettingsSection =
  | "general"
  | "printer"
  | "billing"
  | "counter"
  | "kitchen"
  | "theme"
  | "shortcuts"
  | "account";

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "printer", label: "Printer" },
  { id: "billing", label: "Billing" },
  { id: "counter", label: "Counter" },
  { id: "kitchen", label: "Kitchen" },
  { id: "theme", label: "Theme" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "account", label: "Account" }
];

type PosSettingsModalProps = {
  open: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
  onLogout?: () => void;
};

export function PosSettingsModal({
  open,
  onClose,
  initialSection = "general",
  onLogout
}: PosSettingsModalProps) {
  const { profile } = useAuth();
  const { mode, setMode, preference, setPreference } = useTheme();
  const { status, syncNow } = useOfflineSync();
  const { settings: posSettings, taxPercent } = usePosSettings();
  const { printers: firestorePrinters } = usePrinters();

  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [desktopSettings, setDesktopSettings] = useState<StaffDesktopSettings | null>(null);
  const [usbPrinters, setUsbPrinters] = useState<PrinterDevice[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isElectron = isDesktopRuntime();

  useEffect(() => {
    if (!open) return;
    setSection(initialSection);
    if (!isElectron) return;
    void (async () => {
      const api = getDesktopApi();
      const [nextSettings, deviceList] = await Promise.all([api.getSettings(), api.listPrinters()]);
      setDesktopSettings(nextSettings);
      setUsbPrinters(deviceList);
    })();
  }, [open, initialSection, isElectron]);

  const saveDesktop = async (partial: Partial<StaffDesktopSettings>) => {
    if (!isElectron) return;
    setSaving(true);
    try {
      const next = await getDesktopApi().saveSettings(partial);
      setDesktopSettings(next);
      setMessage("Settings saved");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (desktopSettings) await saveDesktop(desktopSettings);
  };

  const refreshPrinters = async () => {
    if (!isElectron) return;
    const deviceList = await getDesktopApi().listPrinters();
    setUsbPrinters(deviceList);
    setMessage(`Found ${deviceList.length} USB printer(s)`);
  };

  return (
    <Modal open={open} onClose={onClose} title="Desktop Settings" widthClass="max-w-4xl">
      <div className="flex min-h-[480px] max-h-[75vh]">
        <nav className="w-[160px] shrink-0 border-r border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/50">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                section === s.id
                  ? "bg-brand-teal text-white"
                  : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <form onSubmit={(e) => void handleSubmit(e)} className="min-w-0 flex-1 overflow-y-auto p-5">
          {message ? (
            <p className="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800 dark:bg-teal-900/30 dark:text-teal-200">
              {message}
            </p>
          ) : null}

          {section === "general" ? (
            <Section title="General">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Restaurant: <strong>{desktopSettings?.restaurantName ?? "Nausheen Fruits"}</strong>
              </p>
              {isElectron && desktopSettings ? (
                <div className="mt-4 space-y-3">
                  <ToggleRow
                    label="Fullscreen mode"
                    checked={desktopSettings.fullscreen}
                    onChange={(checked) => setDesktopSettings({ ...desktopSettings, fullscreen: checked })}
                  />
                  <ToggleRow
                    label="Launch on startup"
                    checked={desktopSettings.autoLaunch}
                    onChange={(checked) => setDesktopSettings({ ...desktopSettings, autoLaunch: checked })}
                  />
                  <ToggleRow
                    label="Sound notifications"
                    checked={desktopSettings.soundNotifications}
                    onChange={(checked) => setDesktopSettings({ ...desktopSettings, soundNotifications: checked })}
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Desktop options require the Electron app.</p>
              )}
            </Section>
          ) : null}

          {section === "printer" ? (
            <Section title="Printer">
              {isElectron && desktopSettings ? (
                <>
                  <button
                    type="button"
                    onClick={() => void refreshPrinters()}
                    className="mb-4 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700"
                  >
                    Scan USB devices
                  </button>
                  <SelectField
                    label="Counter / Invoice printer"
                    value={desktopSettings.counterPrinterInterface ?? ""}
                    onChange={(v) => setDesktopSettings({ ...desktopSettings, counterPrinterInterface: v || null })}
                    options={usbPrinters.map((d) => ({ value: d.path, label: `${d.path}${d.manufacturer ? ` · ${d.manufacturer}` : ""}` }))}
                  />
                  <SelectField
                    label="Kitchen / KOT printer"
                    value={desktopSettings.kitchenPrinterInterface ?? ""}
                    onChange={(v) => setDesktopSettings({ ...desktopSettings, kitchenPrinterInterface: v || null })}
                    options={usbPrinters.map((d) => ({ value: d.path, label: `${d.path}${d.manufacturer ? ` · ${d.manufacturer}` : ""}` }))}
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">USB printing is available in the Electron desktop app.</p>
              )}
            </Section>
          ) : null}

          {section === "billing" ? (
            <Section title="Billing">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tax rate</dt>
                  <dd className="font-bold">{taxPercent}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Payment provider</dt>
                  <dd className="font-bold capitalize">{posSettings.paymentProvider}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Enabled methods</dt>
                  <dd className="font-bold">{posSettings.enabledPaymentMethods?.join(", ") ?? "—"}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-slate-500">Billing rules are managed in admin dashboard → POS settings.</p>
            </Section>
          ) : null}

          {section === "counter" ? (
            <Section title="Counter">
              <p className="text-sm text-slate-600">Counter printer (Firestore):</p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {posSettings.counterPrinterId ?? "Not set"} ·{" "}
                {firestorePrinters.find((p) => p.id === posSettings.counterPrinterId)?.name ?? "—"}
              </p>
              <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm font-semibold">Offline sync</p>
                <p className="mt-1 text-xs text-slate-500">
                  {status.online ? "Online" : "Offline"} · {status.pendingCount} queued order(s)
                </p>
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  className="mt-3 rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-bold text-white"
                >
                  Sync now
                </button>
              </div>
            </Section>
          ) : null}

          {section === "kitchen" ? (
            <Section title="Kitchen">
              <p className="text-sm text-slate-600">Kitchen printer (Firestore):</p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {posSettings.kitchenPrinterId ?? "Not set"} ·{" "}
                {firestorePrinters.find((p) => p.id === posSettings.kitchenPrinterId)?.name ?? "—"}
              </p>
              <p className="mt-4 text-xs text-slate-500">KOT prints automatically on order submit when configured.</p>
            </Section>
          ) : null}

          {section === "theme" ? (
            <Section title="Theme">
              <p className="mb-4 text-sm text-theme-text-secondary">Choose appearance for the POS workspace. System follows your OS setting.</p>
              <div className="flex gap-2">
                {(["light", "dark", "system"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => (opt === "system" ? setPreference("system") : setMode(opt))}
                    className={`flex-1 rounded-xl border border-theme-border py-3 text-sm font-bold capitalize transition ${
                      (opt === "system" ? preference === "system" : mode === opt)
                        ? "border-theme-primary bg-theme-primary-muted text-theme-primary"
                        : "text-theme-text-secondary hover:bg-theme-hover"
                    }`}
                  >
                    {opt === "light" ? "☀ Light" : opt === "dark" ? "🌙 Dark" : "💻 System"}
                  </button>
                ))}
              </div>
            </Section>
          ) : null}

          {section === "shortcuts" ? (
            <Section title="Keyboard shortcuts">
              <ul className="space-y-2 text-sm">
                {[
                  ["F1", "Search products"],
                  ["F2", "New order"],
                  ["F3", "Accept payment"],
                  ["F4", "Print"],
                  ["F5", "Hold order"],
                  ["F6", "Discount 10%"],
                  ["F7", "Customer focus"],
                  ["F8", "Order history"],
                  ["ESC", "Cancel / close"]
                ].map(([key, desc]) => (
                  <li key={key} className="flex gap-3">
                    <kbd className="min-w-[48px] rounded bg-slate-100 px-2 py-1 text-center font-mono text-xs dark:bg-slate-800">
                      {key}
                    </kbd>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {section === "account" ? (
            <Section title="Account">
              <p className="text-lg font-bold">{profile?.name ?? "Staff"}</p>
              <p className="text-sm text-slate-500">{profile?.email}</p>
              <p className="mt-2 inline-block rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                {profile?.role ? roleLabel(profile.role) : "Staff"}
              </p>
              {onLogout ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    void onLogout();
                  }}
                  className="mt-6 w-full rounded-xl border-2 border-red-300 py-3 font-bold text-red-600"
                >
                  Log out
                </button>
              ) : null}
            </Section>
          ) : null}

          {isElectron && desktopSettings && section !== "shortcuts" && section !== "account" && section !== "theme" ? (
            <div className="mt-6 flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => void getDesktopApi().toggleFullscreen()}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold dark:border-slate-700"
              >
                Toggle fullscreen
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      {children}
    </div>
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
    <label className="flex min-h-[44px] items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-brand-teal" />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="mb-4 block text-sm font-semibold text-slate-700 dark:text-slate-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-brand-teal dark:border-slate-700 dark:bg-slate-800"
      >
        <option value="">Auto-detect first USB printer</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
