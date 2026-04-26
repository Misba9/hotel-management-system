"use client";

import { useState } from "react";
import { uploadImage } from "@/lib/upload-menu-image";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

export function StorageDebugUploader() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string>("");

  async function onFileSelected(file: File | null) {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      const message = `[debug-upload] rejected type=${file.type}. Use JPG/PNG only.`;
      console.error(message);
      setResult(message);
      return;
    }

    setUploading(true);
    setResult("");
    try {
      const url = await uploadImage(file, "admin-menu/debug");
      const message = `[debug-upload] success: ${url}`;
      console.log(message);
      setResult(message);
    } catch (error) {
      console.error("[debug-upload] failure:", error);
      setResult(error instanceof Error ? error.message : "Debug upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Storage Debug Uploader (Temporary)</p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Use this to test direct Firebase SDK upload from localhost.</p>
      <input
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        className="mt-3 block w-full text-sm text-slate-700 dark:text-slate-300"
        disabled={uploading}
        onChange={(event) => {
          void onFileSelected(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
      {uploading ? <p className="mt-2 text-xs text-orange-600">Uploading...</p> : null}
      {result ? <p className="mt-2 break-all text-xs text-slate-700 dark:text-slate-300">{result}</p> : null}
    </div>
  );
}
