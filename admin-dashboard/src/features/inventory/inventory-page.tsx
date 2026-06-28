"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Package, TrendingDown, TrendingUp, Warehouse } from "lucide-react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";

const StockChart = dynamic(
  () => import("@/components/charts/premium-charts").then((m) => m.TopProductsBar),
  { ssr: false, loading: () => <TableSkeleton /> }
);

type StockItem = {
  id: string;
  ingredientName: string;
  currentStock: number;
  minStock: number;
  unit?: string;
};

export function InventoryPageFeature() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
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
        return;
      }
      const data = (await res.json()) as { items: StockItem[] };
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
        body: JSON.stringify({ ingredientName: ingredientName.trim(), currentStock: current, minStock: min, unit: unit.trim() || "kg" })
      });
      if (!res.ok) {
        setError("Failed to create inventory item.");
        return;
      }
      setIngredientName("");
      setCurrentStock("0");
      setMinStock("10");
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

  const lowStock = stock.filter((s) => s.currentStock <= s.minStock).length;
  const outOfStock = stock.filter((s) => s.currentStock <= 0).length;
  const stockValue = stock.reduce((sum, s) => sum + s.currentStock * 120, 0);

  return (
    <PageShell badge="Inventory Control" title="Inventory Dashboard" description="Materials · recipes · purchase · expiry tracking">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Total Materials" value={stock.length} icon={Warehouse} accent="orange" loading={loading} />
        <MetricCard title="Low Stock" value={lowStock} icon={AlertTriangle} accent="amber" loading={loading} />
        <MetricCard title="Out of Stock" value={outOfStock} icon={TrendingDown} accent="rose" loading={loading} />
        <MetricCard title="Stock Value" value={stockValue} formatAsCurrency icon={TrendingUp} accent="emerald" loading={loading} />
        <MetricCard title="Recipe Coverage" value="84%" icon={Package} accent="violet" loading={loading} />
        <MetricCard title="Expiry Alerts" value={3} icon={AlertTriangle} accent="rose" loading={loading} />
      </div>

      <Tabs defaultValue="materials">
        <TabsList className="flex-wrap">
          {["materials", "recipes", "purchase", "suppliers", "transfers", "wastage", "activity", "expiry"].map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="materials">
          <div className="grid gap-6 lg:grid-cols-3">
            <GlassCard className="lg:col-span-2" hover>
              <h3 className="mb-4 font-semibold text-theme-text-primary">Stock Movement</h3>
              <StockChart items={stock.slice(0, 6).map((s) => ({ name: s.ingredientName, sold: s.currentStock }))} />
            </GlassCard>

            <GlassCard hover>
              <h3 className="mb-4 font-semibold text-theme-text-primary">Add Material</h3>
              {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}
              <div className="space-y-3">
                <Input placeholder="Ingredient name" value={ingredientName} onChange={(e) => setIngredientName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Current" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} />
                  <Input placeholder="Min stock" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
                </div>
                <Input placeholder="Unit (kg)" value={unit} onChange={(e) => setUnit(e.target.value)} />
                <Button className="w-full" onClick={() => void addItem()} disabled={saving}>
                  {saving ? "Adding…" : "Add Material"}
                </Button>
              </div>
            </GlassCard>
          </div>

          <GlassCard hover className="mt-6">
            <h3 className="mb-4 font-semibold text-theme-text-primary">Materials List</h3>
            {loading ? (
              <TableSkeleton />
            ) : stock.length === 0 ? (
              <p className="py-8 text-center text-sm text-theme-text-secondary">No inventory items yet.</p>
            ) : (
              <div className="space-y-2">
                {stock.map((item) => {
                  const isLow = item.currentStock <= item.minStock;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-theme-border bg-theme-card p-3"
                    >
                      <div>
                        <p className="font-medium text-theme-text-primary">{item.ingredientName}</p>
                        <p className="text-xs text-theme-text-secondary">
                          {item.currentStock}
                          {item.unit ?? "kg"} · Min {item.minStock}
                          {item.unit ?? "kg"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isLow ? "danger" : "success"}>{isLow ? "Low" : "Healthy"}</Badge>
                        <Button variant="secondary" size="sm" onClick={() => void updateItem(item.id, { currentStock: item.currentStock - 1 })}>
                          -1
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => void updateItem(item.id, { currentStock: item.currentStock + 1 })}>
                          +1
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </TabsContent>

        {["recipes", "purchase", "suppliers", "transfers", "wastage", "activity", "expiry"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <GlassCard>
              <p className="py-12 text-center text-sm capitalize text-theme-text-secondary">{tab} module — connect your backend workflows here.</p>
            </GlassCard>
          </TabsContent>
        ))}
      </Tabs>
    </PageShell>
  );
}
