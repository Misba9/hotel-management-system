"use client";

/**
 * Menu image uploads — **Firebase Storage Web SDK only** (`uploadBytes` + `getDownloadURL`).
 * Do not use `fetch` / `axios` / manual POST to `firebasestorage.googleapis.com`.
 *
 * Uses `getStorage(getFirebaseApp())` so the bucket matches the **named** admin app and
 * `storageBucket` from config (normalized to `*.appspot.com` in `getFirebaseWebConfig`).
 */

import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { getFirebaseApp } from "@/lib/firebase";

export async function uploadImage(file: File, folder = "admin-menu"): Promise<string> {
  if (!file) throw new Error("No file selected");

  if (process.env.NODE_ENV === "development") {
    console.log("[uploadImage] Uploading file:", file.name, file.size, file.type);
  }

  const safeName = file.name.replace(/[^\w.\-]/g, "_").replace(/_+/g, "_") || "image";
  const fileName = `${Date.now()}_${safeName}`;
  const prefix = folder.replace(/^\/+|\/+$/g, "");

  const storage = getStorage(getFirebaseApp());
  const storageRef = ref(storage, `${prefix}/${fileName}`);

  await uploadBytes(storageRef, file, {
    contentType: file.type?.startsWith("image/") ? file.type : "image/jpeg"
  });
  return getDownloadURL(storageRef);
}
