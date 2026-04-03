"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";
import { MenuDeleteDialog } from "@/features/menu/menu-delete-dialog";
import { MenuProductModal, type MenuProductFormValues } from "@/features/menu/menu-product-modal";

export type MenuItemRow = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  categoryId?: string;
  imageUrl?: string;
};

type CategoryRow = { id: string; name: string; active?: boolean };

type Flash = { type: "success" | "error"; message: string };

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status}).`;
}

export function MenuPageFeature() {
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalInitial, setModalInitial] = useState<MenuProductFormValues | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [categoryName, setCategoryName] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);

  const fallbackCategoryId = useMemo(() => {
    const active = categories.filter((c) => c.active !== false);
    const list = active.length ? active : categories;
    return list[0]?.id ?? "fresh_juices";
  }, [categories]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const categoriesForSelect = useMemo(() => {
    const active = categories.filter((c) => c.active !== false);
    return active.length ? active : categories;
  }, [categories]);

  const showFlash = useCallback((next: Flash) => {
    setFlash(next);
  }, []);

  useEffect(() => {
    if (!flash || flash.type !== "success") return;
    const t = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(t);
  }, [flash]);

  const loadItems = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const res = await adminApiFetch("/api/menu");
      if (!res.ok) {
        setListError(await readApiError(res));
        return;
      }
      const data = (await res.json()) as { items: MenuItemRow[] };
      setItems(data.items ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load menu items.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await adminApiFetch("/api/categories");
      if (!res.ok) {
        setListError(await readApiError(res));
        return;
      }
      const data = (await res.json()) as { items: CategoryRow[] };
      setCategories(data.items ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load categories.");
    }
  }, []);

  useEffect(() => {
    void loadItems();
    void loadCategories();
  }, [loadItems, loadCategories]);

  function openCreateModal() {
    setModalMode("create");
    setEditingId(null);
    setModalInitial(null);
    setProductModalOpen(true);
  }

  function openEditModal(item: MenuItemRow) {
    setModalMode("edit");
    setEditingId(item.id);
    setModalInitial({
      name: item.name,
      price: item.price,
      categoryId: item.categoryId ?? fallbackCategoryId,
      imageUrl: item.imageUrl ?? "",
      available: item.available
    });
    setProductModalOpen(true);
  }

  async function handleModalSubmit(values: MenuProductFormValues) {
    setModalSubmitting(true);
    setFlash(null);
    try {
      if (modalMode === "create") {
        const res = await adminApiFetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            price: values.price,
            categoryId: values.categoryId,
            imageUrl: values.imageUrl,
            available: values.available
          })
        });
        if (!res.ok) {
          showFlash({ type: "error", message: await readApiError(res) });
          return;
        }
        showFlash({ type: "success", message: "Product added." });
      } else if (editingId) {
        const res = await adminApiFetch(`/api/menu/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            price: values.price,
            categoryId: values.categoryId,
            imageUrl: values.imageUrl,
            available: values.available
          })
        });
        if (!res.ok) {
          showFlash({ type: "error", message: await readApiError(res) });
          return;
        }
        showFlash({ type: "success", message: "Product updated." });
      }
      setProductModalOpen(false);
      await loadItems();
    } catch (e) {
      showFlash({ type: "error", message: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setModalSubmitting(false);
    }
  }

  async function toggleAvailable(item: MenuItemRow) {
    setFlash(null);
    try {
      const res = await adminApiFetch(`/api/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available })
      });
      if (!res.ok) {
        showFlash({ type: "error", message: await readApiError(res) });
        return;
      }
      showFlash({
        type: "success",
        message: !item.available ? "Product is now available." : "Product hidden from menu."
      });
      await loadItems();
    } catch (e) {
      showFlash({ type: "error", message: e instanceof Error ? e.message : "Update failed." });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setFlash(null);
    try {
      const res = await adminApiFetch(`/api/menu/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        showFlash({ type: "error", message: await readApiError(res) });
        return;
      }
      showFlash({ type: "success", message: "Product deleted." });
      const removedId = deleteTarget.id;
      setDeleteTarget(null);
      if (editingId === removedId) {
        setProductModalOpen(false);
        setEditingId(null);
      }
      await loadItems();
    } catch (e) {
      showFlash({ type: "error", message: e instanceof Error ? e.message : "Delete failed." });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function addCategory() {
    const name = categoryName.trim();
    if (name.length < 2) {
      showFlash({ type: "error", message: "Category name must be at least 2 characters." });
      return;
    }
    setCategoryBusy(true);
    setFlash(null);
    try {
      const res = await adminApiFetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        showFlash({ type: "error", message: await readApiError(res) });
        return;
      }
      setCategoryName("");
      showFlash({ type: "success", message: "Category added." });
      await loadCategories();
    } catch (e) {
      showFlash({ type: "error", message: e instanceof Error ? e.message : "Failed to add category." });
    } finally {
      setCategoryBusy(false);
    }
  }

  async function toggleCategory(category: CategoryRow) {
    setFlash(null);
    try {
      const res = await adminApiFetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !(category.active ?? true) })
      });
      if (!res.ok) {
        showFlash({ type: "error", message: await readApiError(res) });
        return;
      }
      await loadCategories();
    } catch (e) {
      showFlash({ type: "error", message: e instanceof Error ? e.message : "Update failed." });
    }
  }

  async function deleteCategory(id: string) {
    setFlash(null);
    try {
      const res = await adminApiFetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        showFlash({ type: "error", message: await readApiError(res) });
        return;
      }
      showFlash({ type: "success", message: "Category removed." });
      await loadCategories();
    } catch (e) {
      showFlash({ type: "error", message: e instanceof Error ? e.message : "Delete failed." });
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Menu management</h2>
          <p className="mt-1 text-sm text-slate-600">Manage products synced to Firebase. Changes apply immediately.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
          disabled={loading || categories.length === 0}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add product
        </button>
      </div>

      {flash ? (
        <div
          role="status"
          className={[
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          ].join(" ")}
        >
          <span>{flash.message}</span>
          <button type="button" className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium hover:underline" onClick={() => setFlash(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <RequestState error={listError} loading={loading} loadingMessage="Loading menu…" />

      {!loading && !listError ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Image</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      No products yet. Add your first product.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-100 bg-slate-100">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No img</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">Rs. {item.price}</td>
                      <td className="px-4 py-3 text-slate-600">{categoryNameById.get(item.categoryId ?? "") ?? item.categoryId ?? "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void toggleAvailable(item)}
                          className={[
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                            item.available
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
                              : "bg-slate-100 text-slate-600 ring-slate-500/20"
                          ].join(" ")}
                        >
                          {item.available ? "Yes" : "No"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <details className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm open:ring-1 open:ring-slate-200">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Manage categories</summary>
        <p className="mt-2 text-xs text-slate-500">Categories appear in the product form. At least one category is required to add products.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="New category name"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
          />
          <button
            type="button"
            onClick={() => void addCategory()}
            disabled={categoryBusy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {categoryBusy ? "Adding…" : "Add category"}
          </button>
        </div>
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="font-medium text-slate-800">{c.name}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => void toggleCategory(c)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
                  {c.active ?? true ? "Deactivate" : "Activate"}
                </button>
                <button type="button" onClick={() => void deleteCategory(c.id)} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </details>

      <MenuProductModal
        open={productModalOpen}
        onClose={() => !modalSubmitting && setProductModalOpen(false)}
        mode={modalMode}
        initial={modalInitial}
        categories={categoriesForSelect}
        fallbackCategoryId={fallbackCategoryId}
        submitting={modalSubmitting}
        onSubmit={handleModalSubmit}
      />

      <MenuDeleteDialog
        open={!!deleteTarget}
        productName={deleteTarget?.name ?? ""}
        submitting={deleteSubmitting}
        onCancel={() => !deleteSubmitting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
