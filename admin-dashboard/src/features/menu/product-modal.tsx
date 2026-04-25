"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadImage } from "@/lib/upload-menu-image";
import type { CategoryRow } from "@/features/menu/menu-types";
import type { MenuProductFormValues } from "@/features/menu/menu-types";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial: MenuProductFormValues | null;
  categories: CategoryRow[];
  fallbackCategoryId: string;
  submitting: boolean;
  storageTargetProductId: string | null;
  onClose: () => void;
  onSubmit: (values: MenuProductFormValues) => Promise<void>;
};

export function ProductModal({
  open,
  mode,
  initial,
  categories,
  fallbackCategoryId,
  submitting,
  storageTargetProductId,
  onClose,
  onSubmit
}: Props) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [size, setSize] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [available, setAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const busy = submitting || localSubmitting;

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setPrice(String(initial.price));
      setCategoryId(initial.categoryId || fallbackCategoryId);
      setSize(initial.size ?? "");
      setIngredients(initial.ingredients ?? "");
      setAvailable(initial.available);
      setImageUrl(initial.imageUrl ?? "");
      setFile(null);
      setPreview(initial.imageUrl?.trim() ? initial.imageUrl : null);
    } else {
      setName("");
      setPrice("");
      setCategoryId(fallbackCategoryId);
      setSize("");
      setIngredients("");
      setAvailable(true);
      setImageUrl("");
      setFile(null);
      setPreview(null);
    }
    setErrors({});
  }, [open, initial, fallbackCategoryId]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f: File | null) {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 2) nextErrors.name = "Name must be at least 2 characters.";
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) nextErrors.price = "Enter a valid price.";
    if (!categoryId) nextErrors.categoryId = "Choose a category.";
    if (mode === "create" && !storageTargetProductId) {
      nextErrors._general = "Missing product id.";
    }
    if (mode === "create" && !file && !imageUrl.trim()) {
      nextErrors.image = "Add a product image.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLocalSubmitting(true);
    try {
      let finalUrl = imageUrl.trim();
      if (file) {
        setIsUploading(true);
        try {
          finalUrl = await uploadImage(file, "admin-menu/products");
        } finally {
          setIsUploading(false);
        }
      }
      const values: MenuProductFormValues = {
        name: trimmedName,
        price: p,
        categoryId,
        size: size.trim(),
        ingredients: ingredients.trim(),
        imageUrl: finalUrl,
        available
      };
      await onSubmit(values);
    } catch (err) {
      setErrors({
        _general:
          err instanceof Error
            ? err.message
            : "Upload failed. Use Firebase Storage SDK only — check Storage rules and sign-in."
      });
    } finally {
      setIsUploading(false);
      setLocalSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-4 py-10">
      <button
        type="button"
        aria-label="Close"
        disabled={busy}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {mode === "create" ? "Add product" : "Edit product"}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto px-5 py-4">
          {errors._general ? <p className="text-sm text-red-600">{errors._general}</p> : null}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              {errors.price ? <p className="mt-1 text-xs text-red-600">{errors.price}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Size
              </label>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                maxLength={120}
                placeholder="e.g. Medium"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.isActive}>
                  {c.name}
                  {!c.isActive ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {errors.categoryId ? <p className="mt-1 text-xs text-red-600">{errors.categoryId}</p> : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ingredients / description</label>
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              rows={3}
              maxLength={4000}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Comma-separated or short description"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Image {mode === "create" ? <span className="text-red-500">*</span> : null}
            </p>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(ev) => {
                ev.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(ev) => {
                ev.preventDefault();
                setDragOver(false);
                pickFile(ev.dataTransfer.files[0] ?? null);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition ${
                dragOver
                  ? "border-orange-400 bg-orange-50/80 dark:border-orange-500 dark:bg-orange-950/30"
                  : "border-slate-200 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-800/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(ev) => pickFile(ev.target.files?.[0] ?? null)}
              />
              {preview ? (
                <img src={preview} alt="" className="mb-2 h-28 w-28 rounded-lg object-cover shadow-sm" />
              ) : (
                <ImagePlus className="mb-2 h-10 w-10 text-slate-400" aria-hidden />
              )}
              <span className="text-center text-xs text-slate-600 dark:text-slate-400">Click or drag image</span>
            </div>
            {errors.image ? <p className="mt-1 text-xs text-red-600">{errors.image}</p> : null}
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-600">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-4 w-4" />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Available for ordering</span>
          </label>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {isUploading
                    ? "Uploading…"
                    : mode === "create"
                      ? "Adding…"
                      : "Saving…"}
                </>
              ) : mode === "create" ? (
                "Add product"
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
