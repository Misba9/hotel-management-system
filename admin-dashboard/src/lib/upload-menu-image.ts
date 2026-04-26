"use client";

/**
 * Menu image uploads via backend API (`/api/upload`) + Firebase Admin SDK.
 * This avoids browser→Storage CORS/preflight failures in local development.
 */

import { adminApiFetch } from "@/shared/lib/admin-api";

async function readUploadApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    /* ignore malformed JSON */
  }
  return `Upload failed (${response.status}).`;
}

export async function uploadImage(file: File, folder = "admin-menu"): Promise<string> {
  if (!file) throw new Error("No file selected");
  if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type.toLowerCase())) {
    throw new Error("Unsupported image format. Please upload JPG or PNG.");
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[uploadImage] Uploading file:", file.name, file.size, file.type);
  }

  const safeName = file.name.replace(/[^\w.\-]/g, "_").replace(/_+/g, "_") || "image";
  const prefix = folder.replace(/^\/+|\/+$/g, "");

  try {
    const renamed = new File([file], `${Date.now()}_${safeName}`, {
      type: file.type || "image/jpeg"
    });
    const form = new FormData();
    form.set("file", renamed);
    form.set("folder", prefix);

    const response = await adminApiFetch("/api/upload", {
      method: "POST",
      body: form
    });
    if (!response.ok) {
      throw new Error(await readUploadApiError(response));
    }

    const data = (await response.json()) as { url?: string };
    const url = typeof data.url === "string" ? data.url.trim() : "";
    if (!url) {
      throw new Error("Upload response missing URL.");
    }
    return url;
  } catch (error) {
    console.error("[uploadImage] API upload error:", error);
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Image upload failed: ${reason}`);
  }
}
