"use client";

import { useEffect, useState } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";

export default function InventoryPage() {
  const [stock, setStock] = useState<Array<{ id: string; ingredientName: string; currentStock: number; minStock: number; unit?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingredientName, setIngredientName] = useState("");
  const [currentStock, setCurrentStock] = useState("0");
  const [minStock, setMinStock] = useState("10");
  const [unit, setUnit] = useState("kg");

  async function loadStock() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/inventory");
      if (!res.ok) {
        setError("Failed to load inventory.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        items: Array<{ id: string; ingredientName: string; currentStock: number; minStock: number; unit?: string }>;
      };
      setStock(data.items ?? []);
    } catch {
      setError("Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStock();
  }, []);

  async function addItem() {
    if (!ingredientName.trim()) return;
    const current = Number(currentStock);
    const min = Number(minStock);
    if (Number.isNaN(current) || Number.isNaN(min) || current < 0 || min < 0) {
      setError("Stock values must be non-negative numbers.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientName: ingredientName.trim(),
          currentStock: current,
          minStock: min,
          unit: unit.trim() || "kg"
        })
      });
      if (!res.ok) {
        setError("Failed to create inventory item.");
        setSaving(false);
        return;
      }
      setIngredientName("");
      setCurrentStock("0");
      setMinStock("10");
      setUnit("kg");
      await loadStock();
    } catch {
      setError("Failed to create inventory item.");
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(id: string, payload: { currentStock?: number; minStock?: number }) {
    setError(null);
    try {
      const res = await adminApiFetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError("Failed to update inventory item.");
        return;
      }
      await loadStock();
    } catch {
      setError("Failed to update inventory item.");
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Inventory Management</h2>
      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">Add Ingredient</h3>
        <div className="flex flex-wrap gap-2">
          <input
            value={ingredientName}
            onChange={(e) => setIngredientName(e.target.value)}
            placeholder="Ingredient name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={currentStock}
            onChange={(e) => setCurrentStock(e.target.value)}
            placeholder="Current stock"
            className="w-32 rounded border px-3 py-2 text-sm"
          />
          <input
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            placeholder="Min stock"
            className="w-32 rounded border px-3 py-2 text-sm"
          />
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" className="w-24 rounded border px-3 py-2 text-sm" />
          <button onClick={addItem} disabled={saving} className="rounded bg-orange-500 px-3 py-2 text-sm text-white disabled:opacity-60">
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
      <RequestState error={error} loading={loading} empty={stock.length === 0} loadingMessage="Loading inventory..." emptyMessage="No inventory items found." />
      {stock.map((item) => (
        <div key={item.id} className="rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <p className="font-medium">{item.ingredientName}</p>
            <p className={item.currentStock <= item.minStock ? "text-red-500" : "text-green-600"}>
              {item.currentStock <= item.minStock ? "Low Stock" : "Healthy"}
            </p>
          </div>
          <p className="text-sm text-gray-500">
            Current: {item.currentStock}
            {item.unit ?? "kg"} | Min: {item.minStock}
            {item.unit ?? "kg"}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => void updateItem(item.id, { currentStock: Math.max(0, item.currentStock - 1) })} className="rounded border px-2 py-1 text-xs">
              -1
            </button>
            <button onClick={() => void updateItem(item.id, { currentStock: item.currentStock + 1 })} className="rounded border px-2 py-1 text-xs">
              +1
            </button>
            <button onClick={() => void updateItem(item.id, { minStock: Math.max(0, item.minStock - 1) })} className="rounded border px-2 py-1 text-xs">
              Min -1
            </button>
            <button onClick={() => void updateItem(item.id, { minStock: item.minStock + 1 })} className="rounded border px-2 py-1 text-xs">
              Min +1
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
