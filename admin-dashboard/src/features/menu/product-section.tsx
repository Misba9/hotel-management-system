"use client";

import { ImageOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { MenuItemRow } from "@/features/menu/menu-types";

function previewIngredients(text: string, max = 48): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

type Props = {
  items: MenuItemRow[];
  loading: boolean;
  error: string | null;
  categoryNameById: Map<string, string>;
  canAdd: boolean;
  onAdd: () => void;
  onEdit: (item: MenuItemRow) => void;
  onDelete: (item: MenuItemRow) => void;
  onToggleAvailable: (item: MenuItemRow) => void;
  onRetry?: () => void;
};

export function ProductSection({
  items,
  loading,
  error,
  categoryNameById,
  canAdd,
  onAdd,
  onEdit,
  onDelete,
  onToggleAvailable,
  onRetry
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Products</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage menu items, availability, and images.</p>
        </div>
        <button
          type="button"
          disabled={!canAdd}
          onClick={onAdd}
          title={!canAdd ? "Create an active category first" : undefined}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add product
        </button>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-600">
          {error}{" "}
          {onRetry ? (
            <button type="button" className="font-medium underline" onClick={() => void onRetry()}>
              Retry
            </button>
          ) : null}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading products…
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-600">
          No products yet. Add a product to populate the menu.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                <th className="px-3 py-3">Image</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Size</th>
                <th className="px-3 py-3">Ingredients</th>
                <th className="px-3 py-3">Available</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const catLabel =
                  row.categoryName?.trim() ||
                  categoryNameById.get(row.categoryId) ||
                  "Uncategorized";
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2">
                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                        {row.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <ImageOff className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-300">₹{row.price}</td>
                    <td className="max-w-[140px] px-3 py-2 text-slate-700 dark:text-slate-300">
                      <span className="line-clamp-2" title={catLabel}>
                        {catLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.size?.trim() || "—"}</td>
                    <td className="max-w-[180px] px-3 py-2 text-slate-600 dark:text-slate-400" title={row.ingredients}>
                      {previewIngredients(row.ingredients)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onToggleAvailable(row)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.available
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {row.available ? "Yes" : "No"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
