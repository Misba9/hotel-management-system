"use client";

import { useEffect, useState } from "react";
import { Building2, Key, Printer, Shield, Palette } from "lucide-react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeSwitcher } from "../../../../shared/theme/react/ThemeSwitcher";
import { useTheme } from "@/components/providers/theme-provider";

type SettingsPayload = {
  businessHours: string;
  deliveryRadiusKm: number;
  taxPercent: number;
  discountPercent: number;
  paymentProvider: "razorpay" | "manual";
  upiVpa: string;
  upiBankName: string;
  enabledPaymentMethods: Array<"cash" | "upi" | "card" | "wallet" | "split">;
  counterPrinterId: string;
  kitchenPrinterId: string;
};

type PrinterRow = {
  id: string;
  name: string;
  type: string;
  role?: string;
  ipAddress?: string;
};

export function SettingsPageFeature() {
  const { resolved, preference } = useTheme();
  const [settings, setSettings] = useState<SettingsPayload>({
    businessHours: "09:00 - 23:00",
    deliveryRadiusKm: 20,
    taxPercent: 5,
    discountPercent: 10,
    paymentProvider: "manual",
    upiVpa: "",
    upiBankName: "",
    enabledPaymentMethods: ["cash", "upi", "card", "split"],
    counterPrinterId: "counter_bluetooth",
    kitchenPrinterId: "kitchen_receipt_default"
  });
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await adminApiFetch("/api/settings");
        if (res.ok) {
          const data = (await res.json()) as { settings?: SettingsPayload };
          if (data.settings) setSettings((p) => ({ ...p, ...data.settings }));
        }
        const pr = await adminApiFetch("/api/printers");
        if (pr.ok) {
          const pdata = (await pr.json()) as { printers?: PrinterRow[] };
          if (pdata.printers) setPrinters(pdata.printers);
        }
      } catch {
        setError("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setStatusMessage(null);
    setError(null);
    try {
      const res = await adminApiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (!res.ok) {
        setError("Failed to save settings.");
        return;
      }
      setStatusMessage("Settings saved successfully.");
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  const settingSections = [
    { id: "restaurant", icon: Building2, label: "Restaurant" },
    { id: "branches", icon: Building2, label: "Branches" },
    { id: "taxes", icon: Shield, label: "Taxes" },
    { id: "printers", icon: Printer, label: "Printers" },
    { id: "payments", icon: Shield, label: "Payments" },
    { id: "roles", icon: Shield, label: "Roles" },
    { id: "api", icon: Key, label: "API Keys" },
    { id: "theme", icon: Palette, label: "Theme" },
    { id: "security", icon: Shield, label: "Security" }
  ];

  return (
    <PageShell badge="Settings" title="Platform Settings" description="Restaurant · branches · taxes · security · audit">
      {statusMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{statusMessage}</div>
      ) : null}
      {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

      <Tabs defaultValue="restaurant">
        <TabsList className="flex-wrap">
          {settingSections.map(({ id, label }) => (
            <TabsTrigger key={id} value={id}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="restaurant">
          <GlassCard hover>
            <h3 className="mb-4 font-semibold text-white">Business Settings</h3>
            {loading ? (
              <p className="text-sm text-white/40">Loading…</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-white/50">Business Hours</span>
                  <Input
                    value={settings.businessHours}
                    onChange={(e) => setSettings((p) => ({ ...p, businessHours: e.target.value }))}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-white/50">Delivery Radius (km)</span>
                  <Input
                    type="number"
                    value={settings.deliveryRadiusKm}
                    onChange={(e) => setSettings((p) => ({ ...p, deliveryRadiusKm: Number(e.target.value) }))}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-white/50">Tax (%)</span>
                  <Input
                    type="number"
                    value={settings.taxPercent}
                    onChange={(e) => setSettings((p) => ({ ...p, taxPercent: Number(e.target.value) }))}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-white/50">Default Discount (%)</span>
                  <Input
                    type="number"
                    value={settings.discountPercent}
                    onChange={(e) => setSettings((p) => ({ ...p, discountPercent: Number(e.target.value) }))}
                  />
                </label>
              </div>
            )}
            <Button className="mt-6" onClick={() => void save()} disabled={saving || loading}>
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </GlassCard>
        </TabsContent>

        <TabsContent value="payments">
          <GlassCard hover>
            <h3 className="mb-4 font-semibold text-white">Payment gateway</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-white/50">Provider</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={settings.paymentProvider}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, paymentProvider: e.target.value as SettingsPayload["paymentProvider"] }))
                  }
                >
                  <option value="manual">Manual UPI / terminal</option>
                  <option value="razorpay">Razorpay (UPI & card online)</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-white/50">Merchant UPI ID</span>
                <Input value={settings.upiVpa} onChange={(e) => setSettings((p) => ({ ...p, upiVpa: e.target.value }))} placeholder="store@upi" />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-medium text-white/50">Bank / display name</span>
                <Input value={settings.upiBankName} onChange={(e) => setSettings((p) => ({ ...p, upiBankName: e.target.value }))} />
              </label>
              <div className="md:col-span-2 space-y-2">
                <span className="text-xs font-medium text-white/50">Enabled cashier methods</span>
                <div className="flex flex-wrap gap-2">
                  {(["cash", "upi", "card", "wallet", "split"] as const).map((m) => {
                    const on = settings.enabledPaymentMethods.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-brand-primary text-white" : "bg-white/10 text-white/60"}`}
                        onClick={() =>
                          setSettings((p) => ({
                            ...p,
                            enabledPaymentMethods: on
                              ? p.enabledPaymentMethods.filter((x) => x !== m)
                              : [...p.enabledPaymentMethods, m]
                          }))
                        }
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-white/40">
              Razorpay keys are set in server env (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET). Manual UPI shows on cashier when provider is Manual.
            </p>
            <Button className="mt-6" onClick={() => void save()} disabled={saving || loading}>
              {saving ? "Saving…" : "Save payment settings"}
            </Button>
          </GlassCard>
        </TabsContent>

        <TabsContent value="printers">
          <GlassCard hover>
            <h3 className="mb-4 font-semibold text-white">Printer routing</h3>
            <p className="mb-4 text-sm text-white/50">Assign counter receipt and kitchen KOT printers. Cashier prints to both after payment.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-white/50">Counter receipt printer</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={settings.counterPrinterId}
                  onChange={(e) => setSettings((p) => ({ ...p, counterPrinterId: e.target.value }))}
                >
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.role ? `(${p.role})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-white/50">Kitchen KOT printer</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={settings.kitchenPrinterId}
                  onChange={(e) => setSettings((p) => ({ ...p, kitchenPrinterId: e.target.value }))}
                >
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.role ? `(${p.role})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {printers.length > 0 ? (
              <ul className="mt-6 space-y-2 text-sm text-white/60">
                {printers.map((p) => (
                  <li key={p.id}>
                    {p.name} · {p.type} {p.ipAddress ? `· ${p.ipAddress}` : ""} {p.role ? `· ${p.role}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-white/40">No printers in Firestore yet. Seed via backend or add printers collection docs.</p>
            )}
            <Button className="mt-6" onClick={() => void save()} disabled={saving || loading}>
              {saving ? "Saving…" : "Save printer routing"}
            </Button>
          </GlassCard>
        </TabsContent>

        <TabsContent value="theme">
          <GlassCard hover>
            <h3 className="mb-2 font-semibold text-theme-text-primary">Appearance</h3>
            <p className="mb-6 text-sm text-theme-text-secondary">
              Choose how the admin panel looks. Your preference is saved on this device.
            </p>
            <ThemeSwitcher />
            <p className="mt-6 text-xs text-theme-text-disabled">
              Active theme: <span className="font-semibold capitalize text-theme-text-secondary">{preference === "system" ? `System (${resolved})` : resolved}</span>
            </p>
          </GlassCard>
        </TabsContent>

        {settingSections
          .filter((s) => !["restaurant", "payments", "printers", "theme"].includes(s.id))
          .map(({ id, label, icon: Icon }) => (
            <TabsContent key={id} value={id}>
              <GlassCard>
                <div className="flex flex-col items-center py-12 text-center">
                  <Icon className="mb-3 h-8 w-8 text-brand-primary/60" />
                  <p className="text-sm text-white/50">{label} configuration — extend with your backend modules.</p>
                  <Button variant="secondary" className="mt-4">
                    Configure {label}
                  </Button>
                </div>
              </GlassCard>
            </TabsContent>
          ))}
      </Tabs>
    </PageShell>
  );
}
