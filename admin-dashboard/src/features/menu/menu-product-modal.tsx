"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";

export type MenuProductFormValues = {
  name: string;
  price: number;
  categoryId: string;
  imageUrl: string;
  available: boolean;
};

type FieldErrors = Partial<Record<keyof MenuProductFormValues | "priceInput", string>>;

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(values: {
  name: string;
  priceInput: string;
  categoryId: string;
  imageUrl: string;
}): FieldErrors | null {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (name.length < 2) errors.name = "Name must be at least 2 characters.";
  if (name.length > 120) errors.name = "Name must be at most 120 characters.";
  if (!values.categoryId.trim()) errors.categoryId = "Choose a category.";
  const priceInput = values.priceInput.trim();
  if (!priceInput) {
    errors.priceInput = "Price is required.";
  } else {
    const n = Number(priceInput);
    if (Number.isNaN(n)) errors.priceInput = "Enter a valid number.";
    else if (n < 0) errors.priceInput = "Price cannot be negative.";
  }
  const img = values.imageUrl.trim();
  if (img && !isHttpUrl(img)) {
    errors.imageUrl = "Enter a valid http(s) image URL or leave empty.";
  }
  return Object.keys(errors).length ? errors : null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initial: MenuProductFormValues | null;
  categories: Array<{ id: string; name: string }>;
  fallbackCategoryId: string;
  submitting: boolean;
  onSubmit: (values: MenuProductFormValues) => Promise<void>;
};

export function MenuProductModal({
  open,
  onClose,
  mode,
  initial,
  categories,
  fallbackCategoryId,
  submitting,
  onSubmit
}: Props) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [categoryId, setCategoryId] = useState(fallbackCategoryId);
  const [imageUrl, setImageUrl] = useState("");
  const [available, setAvailable] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setPriceInput(String(initial.price));
      setCategoryId(initial.categoryId || fallbackCategoryId);
      setImageUrl(initial.imageUrl ?? "");
      setAvailable(initial.available);
    } else {
      setName("");
      setPriceInput("");
      setCategoryId(fallbackCategoryId);
      setImageUrl("");
      setAvailable(true);
    }
    setFieldErrors(null);
  }, [open, initial, fallbackCategoryId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate({ name, priceInput, categoryId, imageUrl });
    if (errs) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors(null);
    const price = Number(priceInput.trim());
    await onSubmit({
      name: name.trim(),
      price,
      categoryId: categoryId.trim(),
      imageUrl: imageUrl.trim(),
      available
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={() => !submitting && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {mode === "create" ? "Add product" : "Edit product"}
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="space-y-4 p-5">
            <div>
              <label htmlFor="menu-name" className="mb-1 block text-sm font-medium text-slate-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="menu-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-primary/30 focus:border-brand-primary focus:ring-2"
                placeholder="e.g. Mango juice"
                autoComplete="off"
                disabled={submitting}
              />
              {fieldErrors?.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="menu-price" className="mb-1 block text-sm font-medium text-slate-700">
                  Price <span className="text-red-500">*</span>
                </label>
                <input
                  id="menu-price"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-primary/30 focus:border-brand-primary focus:ring-2"
                  placeholder="0"
                  disabled={submitting}
                />
                {fieldErrors?.priceInput ? <p className="mt-1 text-xs text-red-600">{fieldErrors.priceInput}</p> : null}
              </div>

              <div>
                <label htmlFor="menu-category" className="mb-1 block text-sm font-medium text-slate-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="menu-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-primary/30 focus:border-brand-primary focus:ring-2"
                  disabled={submitting || categories.length === 0}
                >
                  {categories.length === 0 ? (
                    <option value="">No categories</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
                {fieldErrors?.categoryId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.categoryId}</p> : null}
              </div>
            </div>

            <div>
              <label htmlFor="menu-image" className="mb-1 block text-sm font-medium text-slate-700">
                Image URL
              </label>
              <input
                id="menu-image"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-primary/30 focus:border-brand-primary focus:ring-2"
                placeholder="https://..."
                disabled={submitting}
              />
              {fieldErrors?.imageUrl ? <p className="mt-1 text-xs text-red-600">{fieldErrors.imageUrl}</p> : null}
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                disabled={submitting}
              />
              <span className="text-sm font-medium text-slate-800">Available for ordering</span>
            </label>
          </div>

          <div className="mt-auto flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || categories.length === 0}
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? "Saving…" : mode === "create" ? "Add product" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
