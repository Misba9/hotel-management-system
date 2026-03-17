"use client";

import { useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api";

type SettingsPayload = {
  businessHours: string;
  deliveryRadiusKm: number;
  taxPercent: number;
  discountPercent: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsPayload>({
    businessHours: "09:00 - 23:00",
    deliveryRadiusKm: 20,
    taxPercent: 5,
    discountPercent: 10
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await adminApiFetch("/api/settings");
      const data = (await res.json()) as { settings?: SettingsPayload };
      if (data.settings) setSettings(data.settings);
    }
    void load();
  }, []);

  async function save() {
    setSaving(true);
    await adminApiFetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    setSaving(false);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Business Settings</h2>
      <div className="rounded-2xl bg-white p-4 shadow">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <p className="mb-1 text-slate-600">Business Hours</p>
            <input
              value={settings.businessHours}
              onChange={(e) => setSettings((prev) => ({ ...prev, businessHours: e.target.value }))}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <p className="mb-1 text-slate-600">Delivery Radius (km)</p>
            <input
              type="number"
              value={settings.deliveryRadiusKm}
              onChange={(e) => setSettings((prev) => ({ ...prev, deliveryRadiusKm: Number(e.target.value) }))}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <p className="mb-1 text-slate-600">Taxes (%)</p>
            <input
              type="number"
              value={settings.taxPercent}
              onChange={(e) => setSettings((prev) => ({ ...prev, taxPercent: Number(e.target.value) }))}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <p className="mb-1 text-slate-600">Discounts (%)</p>
            <input
              type="number"
              value={settings.discountPercent}
              onChange={(e) => setSettings((prev) => ({ ...prev, discountPercent: Number(e.target.value) }))}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button onClick={save} className="mt-4 rounded bg-orange-500 px-4 py-2 text-sm text-white">
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </section>
  );
}
