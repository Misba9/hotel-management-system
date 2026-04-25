import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { RequestUserAuthError, resolveRequestUser } from "@shared/utils/request-user";
import { z } from "zod";

/** Aligned with client `users/{uid}` (`/lib/user-service.ts`). */
const profileSchema = z.object({
  name: z.string().trim().min(0).max(120),
  email: z.string().email().max(200).or(z.literal("")),
  phone: z.string().trim().max(40)
});

const profilePatchSchema = profileSchema.partial();

const emptyProfile = {
  name: "",
  email: "",
  phone: ""
};

export async function GET(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const snap = await adminDb.collection("users").doc(user.userId).get();
    if (!snap.exists) {
      return Response.json({ profile: emptyProfile }, { status: 200 });
    }
    const raw = snap.data() as Record<string, unknown>;
    const merged = {
      name: String(raw.name ?? raw.fullName ?? ""),
      email: String(raw.email ?? ""),
      phone: String(raw.phone ?? "")
    };
    const parsed = profileSchema.safeParse(merged);
    if (!parsed.success) {
      return Response.json({ profile: emptyProfile }, { status: 200 });
    }
    return Response.json({ profile: parsed.data }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestUserAuthError) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
    return Response.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const patch = profilePatchSchema.parse(await request.json());
    const updates: Record<string, unknown> = {
      ...patch,
      updatedAt: FieldValue.serverTimestamp()
    };
    await adminDb.collection("users").doc(user.userId).set(updates, { merge: true });
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestUserAuthError) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
