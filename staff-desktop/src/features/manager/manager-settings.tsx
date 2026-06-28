import { useEffect, useMemo, useState } from "react";
import { getDesktopApi, isDesktopRuntime } from "@/lib/desktop-api";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  updateStaffDisplayName,
  updateStaffPassword
} from "@/lib/firebase";
import type { PrinterDevice, StaffDesktopSettings } from "../../../electron/main-types";

type Props = {
  lastUpdated: Date | null;
};

type LanguageCode = "en" | "hi" | "ar";

type NotificationChannelKey =
  | "kitchenDelay"
  | "lowStock"
  | "printerOffline"
  | "refundApproval"
  | "discountApproval"
  | "newOnlineOrder"
  | "swiggy"
  | "zomato";

type ManagerLocalSettings = {
  restaurantOpen: boolean;
  language: LanguageCode;
  channels: Record<NotificationChannelKey, boolean>;
};

const LOCAL_SETTINGS_KEY = "manager.settings.v1";

const DEFAULT_LOCAL_SETTINGS: ManagerLocalSettings = {
  restaurantOpen: true,
  language: "en",
  channels: {
    kitchenDelay: true,
    lowStock: true,
    printerOffline: true,
    refundApproval: true,
    discountApproval: true,
    newOnlineOrder: true,
    swiggy: true,
    zomato: true
  }
};

function loadLocalSettings(): ManagerLocalSettings {
  if (typeof window === "undefined") return DEFAULT_LOCAL_SETTINGS;
  try {
    const raw = window.localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (!raw) return DEFAULT_LOCAL_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ManagerLocalSettings>;
    return {
      restaurantOpen:
        typeof parsed.restaurantOpen === "boolean"
          ? parsed.restaurantOpen
          : DEFAULT_LOCAL_SETTINGS.restaurantOpen,
      language:
        parsed.language === "en" || parsed.language === "hi" || parsed.language === "ar"
          ? parsed.language
          : DEFAULT_LOCAL_SETTINGS.language,
      channels: {
        ...DEFAULT_LOCAL_SETTINGS.channels,
        ...(parsed.channels ?? {})
      }
    };
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
}

function saveLocalSettings(next: ManagerLocalSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(next));
}

function languageLabel(code: LanguageCode): string {
  if (code === "hi") return "Hindi";
  if (code === "ar") return "Arabic";
  return "English";
}

export function ManagerSettings({ lastUpdated }: Props) {
  const { profile } = useAuth();
  const { preference, setPreference } = useTheme();
  const [localSettings, setLocalSettings] = useState<ManagerLocalSettings>(() => loadLocalSettings());
  const [desktopSettings, setDesktopSettings] = useState<StaffDesktopSettings | null>(null);
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingDesktop, setSavingDesktop] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.name ?? "");
  }, [profile?.name]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    void (async () => {
      try {
        const api = getDesktopApi();
        const [settings, availablePrinters] = await Promise.all([api.getSettings(), api.listPrinters()]);
        setDesktopSettings(settings);
        setPrinters(availablePrinters);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load desktop settings.");
      }
    })();
  }, []);

  const restaurantStatusLabel = localSettings.restaurantOpen ? "Open" : "Closed";

  const receiptLines = useMemo(() => {
    const restaurantName = desktopSettings?.restaurantName ?? "Nausheen Fruits";
    return [
      restaurantName,
      "INVOICE PREVIEW",
      "Order: MG-SETTINGS-001",
      "Date: " + new Date().toLocaleString(),
      "Channel: Manager Panel",
      "1 x Mango Shake       120",
      "1 x Fruit Bowl        180",
      "--------------------------",
      "Total               INR 300",
      "Thank you"
    ];
  }, [desktopSettings?.restaurantName]);

  function updateLocal(next: ManagerLocalSettings) {
    setLocalSettings(next);
    saveLocalSettings(next);
    setMessage("Manager settings saved.");
    setError(null);
  }

  async function saveDesktop(partial: Partial<StaffDesktopSettings>, successMessage: string) {
    if (!isDesktopRuntime()) {
      setError("Desktop-only printer and notification preferences require the Electron app.");
      return;
    }
    setSavingDesktop(true);
    setError(null);
    try {
      const next = await getDesktopApi().saveSettings(partial);
      setDesktopSettings(next);
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save desktop settings.");
    } finally {
      setSavingDesktop(false);
    }
  }

  async function refreshPrinters() {
    if (!isDesktopRuntime()) return;
    try {
      const found = await getDesktopApi().listPrinters();
      setPrinters(found);
      setMessage(`Found ${found.length} printer device(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh printer list.");
    }
  }

  async function runPrinterTest() {
    if (!isDesktopRuntime()) {
      setError("Printer test is available only in the desktop runtime.");
      return;
    }
    setTestingPrinter(true);
    setError(null);
    try {
      const result = await getDesktopApi().printInvoice({
        orderNumber: "MGR-TEST-001",
        tableNumber: "T1",
        source: "manager_settings",
        paymentMethod: "test",
        createdAt: new Date().toISOString(),
        items: [
          { name: "Test Receipt Item", quantity: 1, price: 1 }
        ],
        subtotal: 1,
        tax: 0,
        total: 1
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Printer test failed.");
      }
      setMessage("Printer test sent successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Printer test failed.");
    } finally {
      setTestingPrinter(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    setError(null);
    try {
      await updateStaffDisplayName(displayName);
      setMessage("Profile updated. Re-login may be needed for all surfaces to refresh.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    setSavingPassword(true);
    setError(null);
    try {
      await updateStaffPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update password. Please verify your current password."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <h3 className="text-base font-bold text-theme-text-primary">Manager Settings</h3>
        <p className="text-xs text-theme-text-secondary">
          Restaurant controls, desktop preferences, notification channels, profile, and password
        </p>
        <p className="mt-2 text-xs text-theme-text-secondary">
          Last update:{" "}
          <span className="font-semibold text-theme-text-primary">
            {lastUpdated
              ? lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                })
              : "—"}
          </span>
        </p>
      </header>

      <div className="space-y-4 p-4 md:p-5">
        {message ? (
          <p className="rounded-xl border border-theme-success/30 bg-theme-success-muted px-3 py-2 text-sm text-theme-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl border border-theme-danger/30 bg-theme-danger-muted px-3 py-2 text-sm text-theme-danger">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-theme-border bg-theme-card p-3">
            <p className="text-xs font-semibold uppercase text-theme-text-secondary">Restaurant Open / Closed</p>
            <p className="mt-1 text-sm text-theme-text-secondary">
              Current status: <span className="font-semibold text-theme-text-primary">{restaurantStatusLabel}</span>
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => updateLocal({ ...localSettings, restaurantOpen: true })}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  localSettings.restaurantOpen
                    ? "bg-theme-primary text-white"
                    : "border border-theme-border bg-theme-surface text-theme-text-secondary"
                }`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => updateLocal({ ...localSettings, restaurantOpen: false })}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  !localSettings.restaurantOpen
                    ? "bg-theme-primary text-white"
                    : "border border-theme-border bg-theme-surface text-theme-text-secondary"
                }`}
              >
                Closed
              </button>
            </div>
          </article>

          <article className="rounded-xl border border-theme-border bg-theme-card p-3">
            <p className="text-xs font-semibold uppercase text-theme-text-secondary">Theme</p>
            <p className="mt-1 text-sm text-theme-text-secondary">
              Active theme: <span className="font-semibold text-theme-text-primary">{preference}</span>
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setPreference("light")}
                className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-text-secondary"
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setPreference("dark")}
                className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-text-secondary"
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setPreference("system")}
                className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-text-secondary"
              >
                System
              </button>
            </div>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-theme-border bg-theme-card p-3">
            <p className="text-xs font-semibold uppercase text-theme-text-secondary">Language</p>
            <p className="mt-1 text-sm text-theme-text-secondary">
              Selected: <span className="font-semibold text-theme-text-primary">{languageLabel(localSettings.language)}</span>
            </p>
            <select
              value={localSettings.language}
              onChange={(event) =>
                updateLocal({ ...localSettings, language: event.target.value as LanguageCode })
              }
              className="mt-3 w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="ar">Arabic</option>
            </select>
          </article>

          <article className="rounded-xl border border-theme-border bg-theme-card p-3">
            <p className="text-xs font-semibold uppercase text-theme-text-secondary">Notification Settings</p>
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
              {(
                [
                  ["kitchenDelay", "Kitchen Delay"],
                  ["lowStock", "Low Stock"],
                  ["printerOffline", "Printer Offline"],
                  ["refundApproval", "Refund Approval"],
                  ["discountApproval", "Discount Approval"],
                  ["newOnlineOrder", "New Online Order"],
                  ["swiggy", "Swiggy"],
                  ["zomato", "Zomato"]
                ] as Array<[NotificationChannelKey, string]>
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5">
                  <span className="text-theme-text-secondary">{label}</span>
                  <input
                    type="checkbox"
                    checked={localSettings.channels[key]}
                    onChange={(event) =>
                      updateLocal({
                        ...localSettings,
                        channels: {
                          ...localSettings.channels,
                          [key]: event.target.checked
                        }
                      })
                    }
                    className="h-4 w-4 accent-[var(--theme-primary)]"
                  />
                </label>
              ))}
            </div>
            <label className="mt-3 flex items-center justify-between rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs">
              <span className="text-theme-text-secondary">Sound Notifications</span>
              <input
                type="checkbox"
                checked={desktopSettings?.soundNotifications ?? true}
                onChange={(event) =>
                  void saveDesktop(
                    { soundNotifications: event.target.checked },
                    "Notification sound preference saved."
                  )
                }
                disabled={!desktopSettings || savingDesktop}
                className="h-4 w-4 accent-[var(--theme-primary)]"
              />
            </label>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-theme-border bg-theme-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-theme-text-secondary">Receipt Preview</p>
              <span className="rounded-full bg-theme-hover px-2 py-0.5 text-[11px] font-semibold text-theme-text-secondary">
                Preview only
              </span>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-theme-border bg-theme-surface p-3 text-[11px] text-theme-text-primary">
{receiptLines.join("\n")}
            </pre>
          </article>

          <article className="rounded-xl border border-theme-border bg-theme-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-theme-text-secondary">Printer Test</p>
              <button
                type="button"
                onClick={() => void refreshPrinters()}
                className="rounded-lg border border-theme-border bg-theme-surface px-2 py-1 text-xs font-semibold text-theme-text-secondary"
              >
                Refresh
              </button>
            </div>
            <p className="mt-2 text-xs text-theme-text-secondary">
              Detected printers: <span className="font-semibold text-theme-text-primary">{printers.length}</span>
            </p>
            <button
              type="button"
              onClick={() => void runPrinterTest()}
              disabled={testingPrinter}
              className="mt-3 rounded-lg bg-theme-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {testingPrinter ? "Printing test..." : "Run Printer Test"}
            </button>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-theme-border bg-theme-card p-3">
            <p className="text-xs font-semibold uppercase text-theme-text-secondary">Profile</p>
            <p className="mt-1 text-xs text-theme-text-secondary">Role: {profile?.role ?? "manager"}</p>
            <label className="mt-3 block text-xs font-semibold text-theme-text-secondary">
              Name
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-2 block text-xs font-semibold text-theme-text-secondary">
              Email
              <input
                type="text"
                value={profile?.email ?? ""}
                disabled
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-hover px-3 py-2 text-sm text-theme-text-secondary"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={savingProfile}
              className="mt-3 rounded-lg bg-theme-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </article>

          <article className="rounded-xl border border-theme-border bg-theme-card p-3">
            <p className="text-xs font-semibold uppercase text-theme-text-secondary">Password</p>
            <label className="mt-3 block text-xs font-semibold text-theme-text-secondary">
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-2 block text-xs font-semibold text-theme-text-secondary">
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-2 block text-xs font-semibold text-theme-text-secondary">
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => void savePassword()}
              disabled={savingPassword}
              className="mt-3 rounded-lg bg-theme-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </article>
        </div>
      </div>
    </section>
  );
}
