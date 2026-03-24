"use client";

import { useEffect, useState } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";

export default function BranchesPage() {
  const [branches, setBranches] = useState<Array<{ id: string; name: string; city: string; deliveryRadiusKm: number; active: boolean }>>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState("20");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBranches() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/branches");
      if (!res.ok) {
        setError("Failed to load branches.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { items: Array<{ id: string; name: string; city: string; deliveryRadiusKm: number; active: boolean }> };
      setBranches(data.items ?? []);
    } catch {
      setError("Failed to load branches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBranches();
  }, []);

  async function saveBranch() {
    if (!name.trim() || !city.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      city: city.trim(),
      deliveryRadiusKm: Number(deliveryRadiusKm)
    };
    let res: Response;
    try {
      res = editingId
        ? await adminApiFetch(`/api/branches/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
        : await adminApiFetch("/api/branches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
    } catch {
      setError(editingId ? "Failed to update branch." : "Failed to create branch.");
      setSaving(false);
      return;
    }
    if (!res.ok) {
      setError(editingId ? "Failed to update branch." : "Failed to create branch.");
      setSaving(false);
      return;
    }
    setName("");
    setCity("");
    setDeliveryRadiusKm("20");
    setEditingId(null);
    setSaving(false);
    await loadBranches();
  }

  async function toggleBranchStatus(branch: { id: string; active: boolean }) {
    setError(null);
    let res: Response;
    try {
      res = await adminApiFetch(`/api/branches/${branch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !branch.active })
      });
    } catch {
      setError("Failed to update branch status.");
      return;
    }
    if (!res.ok) {
      setError("Failed to update branch status.");
      return;
    }
    await loadBranches();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Branch Management</h2>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Branch name" className="rounded border px-3 py-2 text-sm" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="rounded border px-3 py-2 text-sm" />
          <input
            value={deliveryRadiusKm}
            onChange={(e) => setDeliveryRadiusKm(e.target.value)}
            placeholder="Radius (km)"
            className="w-28 rounded border px-3 py-2 text-sm"
          />
          <button onClick={saveBranch} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">
            {saving ? "Saving..." : editingId ? "Save Branch" : "Add Branch"}
          </button>
          {editingId ? (
            <button
              onClick={() => {
                setEditingId(null);
                setName("");
                setCity("");
                setDeliveryRadiusKm("20");
              }}
              className="rounded border px-3 py-2 text-sm"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <RequestState error={error} loading={loading} empty={branches.length === 0} loadingMessage="Loading branches..." emptyMessage="No branches found." />
      {branches.map((branch) => (
        <div key={branch.id} className="rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{branch.name}</p>
              <p className="text-sm text-gray-500">
                {branch.city} | Radius: {branch.deliveryRadiusKm}km
              </p>
              <p className="text-sm">{branch.active ? "Active" : "Inactive"}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingId(branch.id);
                  setName(branch.name);
                  setCity(branch.city);
                  setDeliveryRadiusKm(String(branch.deliveryRadiusKm));
                }}
                className="rounded border px-3 py-1 text-sm"
              >
                Edit
              </button>
              <button onClick={() => void toggleBranchStatus(branch)} className="rounded border px-3 py-1 text-sm">
                {branch.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
