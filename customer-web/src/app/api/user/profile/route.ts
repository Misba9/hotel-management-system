import { adminDb } from "@shared/firebase/admin";
import { RequestUserAuthError, resolveRequestUser } from "@shared/utils/request-user";
import { z } from "zod";

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().trim().min(6).max(40),
  addresses: z.array(z.string().trim().min(3).max(300)).max(10)
});

const profilePatchSchema = profileSchema.partial();

const defaultProfile = {
  fullName: "Guest User",
  email: "guest@example.com",
  phone: "",
  addresses: []
};

export async function GET(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const snap = await adminDb.collection("customer_profiles").doc(user.userId).get();
    if (!snap.exists) {
      return Response.json({ profile: defaultProfile }, { status: 200 });
    }
    const parsed = profileSchema.safeParse({ ...defaultProfile, ...(snap.data() as Record<string, unknown>) });
    if (!parsed.success) {
      return Response.json({ profile: defaultProfile }, { status: 200 });
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
    await adminDb.collection("customer_profiles").doc(user.userId).set(
      {
        ...patch,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
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
