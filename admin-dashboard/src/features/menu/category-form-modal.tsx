"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { collection, doc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { uploadImage } from "@/lib/upload-menu-image";
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
  open: boolean;
  mode: "create" | "edit";
  /** Firestore id: pre-generated for create, existing for edit. */
  categoryId: string | null;
  initial: CategoryRow | null;
  submitting: boolean;
  onClose: () => void;
  onSubmittingChange: (v: boolean) => void;
  onToast: (t: MenuToastPayload) => void;
  onSaved: () => Promise<void>;
};

export function CategoryFormModal({
  open,
  mode,
  categoryId,
  initial,
  submitting,
  onClose,
  onSubmittingChange,
  onToast,
  onSaved
}: Props) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setNameError("");
    setFile(null);
    setPreview(initial?.imageUrl?.trim() ? initial.imageUrl : null);
  }, [open, initial]);

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
    if (!categoryId) {
      onToast({ type: "error", message: "Missing category id. Try again." });
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    setNameError("");
    onSubmittingChange(true);
    try {
      let imageUrl = initial?.imageUrl?.trim() ?? "";
      if (file) {
        setIsUploading(true);
        try {
          imageUrl = await uploadImage(file, "admin-menu/categories");
        } finally {
          setIsUploading(false);
        }
      } else if (mode === "create" && !imageUrl) {
        onToast({ type: "error", message: "Please choose a category image." });
        onSubmittingChange(false);
        return;
      }

      if (mode === "create") {
        const res = await adminApiFetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: categoryId,
            name: trimmed,
            imageUrl,
            isActive: true
          })
        });
        if (!res.ok) {
          onToast({ type: "error", message: await readApiError(res) });
          return;
        }
        onToast({ type: "success", message: "Category added." });
      } else {
        const res = await adminApiFetch(`/api/categories/${categoryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            ...(imageUrl ? { imageUrl } : {})
          })
        });
        if (!res.ok) {
          onToast({ type: "error", message: await readApiError(res) });
          return;
        }
        onToast({ type: "success", message: "Category updated." });
      }
      onClose();
      await onSaved();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Upload or save failed. Check Storage rules and that you are signed in.";
      onToast({ type: "error", message: msg });
    } finally {
      setIsUploading(false);
      onSubmittingChange(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        disabled={submitting}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={() => !submitting && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {mode === "create" ? "Add category" : "Edit category"}
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="cat-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Category name <span className="text-red-500">*</span>
            </label>
            <input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="e.g. Fresh Juices"
            />
            {nameError ? <p className="mt-1 text-xs text-red-600">{nameError}</p> : null}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Image {mode === "create" ? <span className="text-red-500">*</span> : <span className="text-slate-400">(optional)</span>}
            </p>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files[0] ?? null);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition ${
                dragOver
                  ? "border-orange-400 bg-orange-50/80 dark:border-orange-500 dark:bg-orange-950/30"
                  : "border-slate-200 bg-slate-50/80 hover:border-orange-300 dark:border-slate-600 dark:bg-slate-800/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              {preview ? (
                <img src={preview} alt="" className="mb-2 h-24 w-24 rounded-lg object-cover shadow-sm" />
              ) : (
                <ImagePlus className="mb-2 h-10 w-10 text-slate-400" aria-hidden />
              )}
              <span className="text-center text-xs text-slate-600 dark:text-slate-400">
                Click or drag an image here
              </span>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {isUploading ? "Uploading…" : "Saving…"}
                </>
              ) : mode === "create" ? (
                "Add category"
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

/** Generate a Firestore doc id for a new category (used before Storage upload). */
export function newCategoryDraftId(): string {
  return doc(collection(getFirebaseDb(), "menu_categories")).id;
}
