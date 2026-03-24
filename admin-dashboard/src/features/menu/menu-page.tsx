"use client";

import { useEffect, useState } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";

export function MenuPageFeature() {
  const [items, setItems] = useState<Array<{ id: string; name: string; price: number; available: boolean; categoryId?: string; imageUrl?: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; active?: boolean }>>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("fresh_juices");
  const [imageUrl, setImageUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await adminApiFetch("/api/menu");
      if (!res.ok) {
        setError("Failed to load menu items.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        items: Array<{ id: string; name: string; price: number; available: boolean; categoryId?: string; imageUrl?: string }>;
      };
      setItems(data.items ?? []);
    } catch {
      setError("Failed to load menu items.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await adminApiFetch("/api/categories");
      if (!res.ok) {
        setError("Failed to load categories.");
        return;
      }
      const data = (await res.json()) as { items: Array<{ id: string; name: string; active?: boolean }> };
      setCategories(data.items ?? []);
    } catch {
      setError("Failed to load categories.");
    }
  }

  useEffect(() => {
    void loadItems();
    void loadCategories();
  }, []);

  async function addItem() {
    if (!name.trim() || !price.trim()) return;
    setError(null);
    if (editingId) {
      const res = await adminApiFetch(`/api/menu/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: Number(price),
          categoryId,
          imageUrl
        })
      });
      if (!res.ok) {
        setError("Failed to update menu item.");
        return;
      }
    } else {
      const res = await adminApiFetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), price: Number(price), categoryId, imageUrl })
      });
      if (!res.ok) {
        setError("Failed to create menu item.");
        return;
      }
    }
    setName("");
    setPrice("");
    setCategoryId("fresh_juices");
    setImageUrl("");
    setEditingId(null);
    await loadItems();
  }

  async function toggleItem(item: { id: string; available: boolean }) {
    const res = await adminApiFetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !item.available })
    });
    if (!res.ok) {
      setError("Failed to update menu item.");
      return;
    }
    await loadItems();
  }

  async function deleteItem(id: string) {
    const res = await adminApiFetch(`/api/menu/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete menu item.");
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setName("");
      setPrice("");
      setImageUrl("");
    }
    await loadItems();
  }

  async function addCategory() {
    if (!categoryName.trim()) return;
    const res = await adminApiFetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName.trim() })
    });
    if (!res.ok) {
      setError("Failed to create category.");
      return;
    }
    setCategoryName("");
    await loadCategories();
  }

  async function toggleCategory(category: { id: string; active?: boolean }) {
    const res = await adminApiFetch(`/api/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !category.active })
    });
    if (!res.ok) {
      setError("Failed to update category.");
      return;
    }
    await loadCategories();
  }

  async function deleteCategory(id: string) {
    const res = await adminApiFetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete category.");
      return;
    }
    await loadCategories();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Menu Management</h2>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" className="rounded border px-3 py-2 text-sm" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="w-24 rounded border px-3 py-2 text-sm" />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded border px-3 py-2 text-sm">
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" className="w-56 rounded border px-3 py-2 text-sm" />
          <button onClick={addItem} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">
            {editingId ? "Save Juice" : "Add Juice"}
          </button>
          {editingId ? (
            <button
              onClick={() => {
                setEditingId(null);
                setName("");
                setPrice("");
                setImageUrl("");
              }}
              className="rounded border px-3 py-2 text-sm"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <RequestState error={error} loading={loading} loadingMessage="Loading menu..." />
      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-3 text-lg font-semibold">Manage Categories</h3>
        <div className="mb-3 flex gap-2">
          <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" className="rounded border px-3 py-2 text-sm" />
          <button onClick={addCategory} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            Add Category
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <p className="font-medium">{category.name}</p>
              <div className="flex gap-2">
                <button onClick={() => toggleCategory(category)} className="rounded border px-2 py-1 text-xs">
                  {category.active ?? true ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => deleteCategory(category.id)} className="rounded border px-2 py-1 text-xs text-red-600">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-gray-500">
              Rs. {item.price} • {item.categoryId ?? "uncategorized"}
            </p>
            {item.imageUrl ? <p className="text-xs text-gray-500">{item.imageUrl}</p> : null}
          </div>
          <div className="flex gap-2">
            <button onClick={() => toggleItem(item)} className="rounded border px-3 py-1 text-sm">
              {item.available ? "Disable" : "Enable"}
            </button>
            <button
              onClick={() => {
                setEditingId(item.id);
                setName(item.name);
                setPrice(String(item.price));
                setCategoryId(item.categoryId ?? "fresh_juices");
                setImageUrl(item.imageUrl ?? "");
              }}
              className="rounded border px-3 py-1 text-sm"
            >
              Edit
            </button>
            <button onClick={() => deleteItem(item.id)} className="rounded border px-3 py-1 text-sm text-red-600">
              Delete
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
