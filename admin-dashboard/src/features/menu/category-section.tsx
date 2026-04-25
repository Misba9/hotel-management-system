"use client";

import { useCallback, useMemo, useState } from "react";
import { ImageOff, Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { CategoryFormModal, newCategoryDraftId } from "@/features/menu/category-form-modal";
import { MenuDeleteDialog } from "@/features/menu/menu-delete-dialog";
import type { CategoryRow } from "@/features/menu/menu-types";
import type { MenuToastPayload } from "@/features/menu/menu-toast";

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status}).`;
}

type Props = {
  categories: CategoryRow[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onToast: (t: MenuToastPayload) => void;
};

export function CategorySection({ categories, loading, onRefresh, onToast }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [draftOrEditId, setDraftOrEditId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
    [categories]
  );

  const openCreate = useCallback(() => {
    try {
      setDraftOrEditId(newCategoryDraftId());
    } catch {
      onToast({ type: "error", message: "Could not prepare category id. Check Firebase configuration." });
      return;
    }
    setEditingCategory(null);
    setModalMode("create");
    setModalOpen(true);
  }, [onToast]);

  const openEdit = useCallback((c: CategoryRow) => {
    setDraftOrEditId(c.id);
    setEditingCategory(c);
    setModalMode("edit");
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (modalSubmitting) return;
    setModalOpen(false);
    setDraftOrEditId(null);
    setEditingCategory(null);
  }, [modalSubmitting]);

  const toggleActive = useCallback(
    async (c: CategoryRow) => {
      const next = !c.isActive;
      try {
        const res = await adminApiFetch(`/api/categories/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: next })
        });
        if (!res.ok) {
          onToast({ type: "error", message: await readApiError(res) });
          return;
        }
        onToast({
          type: "success",
          message: next ? "Category is active." : "Category deactivated."
        });
        await onRefresh();
      } catch (e) {
        onToast({ type: "error", message: e instanceof Error ? e.message : "Update failed." });
      }
    },
    [onRefresh, onToast]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      const res = await adminApiFetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        onToast({ type: "error", message: await readApiError(res) });
        return;
      }
      onToast({ type: "success", message: "Category deleted." });
      setDeleteTarget(null);
      if (modalOpen && draftOrEditId === deleteTarget.id) {
        setModalOpen(false);
        setDraftOrEditId(null);
        setEditingCategory(null);
      }
      await onRefresh();
    } catch (e) {
      onToast({ type: "error", message: e instanceof Error ? e.message : "Delete failed." });
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTarget, onRefresh, onToast, modalOpen, draftOrEditId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Categories</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Active categories appear first on the storefront. Upload images to Firebase Storage.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add category
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading categories…
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-600">
          No categories yet. Add one to enable products.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((c) => (
            <li
              key={c.id}
              className={`flex flex-col overflow-hidden rounded-xl border bg-slate-50/80 dark:bg-slate-800/40 ${
                c.isActive ? "border-slate-200 dark:border-slate-600" : "border-amber-200/80 opacity-90 dark:border-amber-900/50"
              }`}
            >
              <div className="relative aspect-square w-full bg-slate-200 dark:bg-slate-700">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <ImageOff className="h-8 w-8" aria-hidden />
                  </div>
                )}
                {!c.isActive ? (
                  <span className="absolute left-2 top-2 rounded-md bg-amber-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Inactive
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-50">{c.name}</p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleActive(c)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Power className="h-3.5 w-3.5" aria-hidden />
                    {c.isActive ? "Off" : "On"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(c)}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CategoryFormModal
        open={modalOpen}
        mode={modalMode}
        categoryId={draftOrEditId}
        initial={editingCategory}
        submitting={modalSubmitting}
        onClose={closeModal}
        onSubmittingChange={setModalSubmitting}
        onToast={onToast}
        onSaved={onRefresh}
      />

      <MenuDeleteDialog
        open={!!deleteTarget}
        title="Delete category?"
        itemName={deleteTarget?.name ?? ""}
        detail="Products that reference this category may need their category updated."
        submitting={deleteSubmitting}
        onCancel={() => !deleteSubmitting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
