import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";

function sanitizeFileName(name: string): string {
  const safe = name.replace(/[^\w.\-]/g, "_").replace(/_+/g, "_");
  return safe || "image";
}

function normalizeBucket(projectId: string, raw: string | undefined): string {
  const bucket = (raw ?? "")
    .trim()
    .replace(/^gs:\/\//i, "")
    .split("/")[0]
    .trim();

  if (!bucket) return `${projectId}.appspot.com`;
  return bucket;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_upload_post", limit: 40, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData();
    const fileEntry = form.get("file");
    const folderEntry = form.get("folder");

    if (!(fileEntry instanceof File)) {
      return Response.json({ error: "Missing file in multipart form data." }, { status: 400 });
    }

    const mime = fileEntry.type.toLowerCase();
    if (!["image/jpeg", "image/jpg", "image/png"].includes(mime)) {
      return Response.json({ error: "Unsupported image format. Please upload JPG or PNG." }, { status: 400 });
    }

    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    if (!projectId) {
      return Response.json({ error: "FIREBASE_PROJECT_ID is not configured." }, { status: 500 });
    }

    const app = getFirebaseAdminApp();
    if (!app) {
      return Response.json({ error: "Firebase Admin SDK is not initialized." }, { status: 500 });
    }

    const bucketName = normalizeBucket(
      projectId,
      process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    );
    const bucket = getStorage(app).bucket(bucketName);
    const folder =
      typeof folderEntry === "string" && folderEntry.trim()
        ? folderEntry.trim().replace(/^\/+|\/+$/g, "")
        : "admin-menu";
    const objectName = `${folder}/${Date.now()}_${sanitizeFileName(fileEntry.name)}`;

    const token = randomUUID();
    const bytes = Buffer.from(await fileEntry.arrayBuffer());
    const object = bucket.file(objectName);

    await object.save(bytes, {
      resumable: false,
      metadata: {
        contentType: mime,
        metadata: { firebaseStorageDownloadTokens: token }
      }
    });

    const url =
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}` +
      `/o/${encodeURIComponent(objectName)}?alt=media&token=${encodeURIComponent(token)}`;

    return Response.json({ url }, { status: 201 });
  } catch (error) {
    console.error("[api/upload] upload failed:", error);
    const message = error instanceof Error ? error.message : "Upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
