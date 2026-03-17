"use client";

import { useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api";

export default function InventoryPage() {
  const [stock, setStock] = useState<Array<{ id: string; ingredientName: string; currentStock: number; minStock: number }>>([]);

  async function loadStock() {
    const res = await adminApiFetch("/api/inventory");
    const data = (await res.json()) as { items: Array<{ id: string; ingredientName: string; currentStock: number; minStock: number }> };
    setStock(data.items ?? []);
  }

  useEffect(() => {
    void loadStock();
  }, []);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Inventory Management</h2>
      {stock.map((item) => (
        <div key={item.id} className="rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <p className="font-medium">{item.ingredientName}</p>
            <p className={item.currentStock <= item.minStock ? "text-red-500" : "text-green-600"}>
              {item.currentStock <= item.minStock ? "Low Stock" : "Healthy"}
            </p>
          </div>
          <p className="text-sm text-gray-500">
            Current: {item.currentStock}kg | Min: {item.minStock}kg
          </p>
        </div>
      ))}
    </section>
  );
}
