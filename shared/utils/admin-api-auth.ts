import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "../../backend/firebase/admin";
import { consumeRateLimit } from "./api-security";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Verified admin from Bearer ID token (`role === "admin"` custom claim). */
export type AdminApiUser = {
  uid: string;
  role: "admin";
  email: string | null;
};

type AdminAuthFailure = { ok: false; response: Response };

type AdminSuccess = { ok: true; user: AdminApiUser };

function jsonFail(status: number, error: string): Response {
  return Response.json({ success: false, error }, { status, headers: NO_STORE });
}

function readRoleClaim(decoded: DecodedIdToken): unknown {
  return (decoded as { role?: unknown }).role;
}

export type AdminApiAuthOptions = {
  rateLimit?: {
    keyPrefix: string;
    limit: number;
    windowMs: number;
  };
};

function applyRateLimitGate(
  request: Request,
  options: AdminApiAuthOptions,
): AdminAuthFailure | null {
  if (!options.rateLimit) return null;
  const blocked = consumeRateLimit(request, options.rateLimit);
  if (!blocked) return null;
  return { ok: false, response: jsonFail(429, "Too many requests") };
}

async function authenticateAdminFromRequest(request: Request): Promise<
  | { ok: true; decodedToken: DecodedIdToken }
  | AdminAuthFailure
> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: jsonFail(401, "Unauthorized") };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, response: jsonFail(401, "Unauthorized") };
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[admin-api-auth] verifyIdToken failed:", error);
    }
    return { ok: false, response: jsonFail(401, "Unauthorized") };
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[admin-api-auth] decoded token:", decodedToken);
  }

  const role = readRoleClaim(decodedToken);
  if (role !== "admin") {
    return { ok: false, response: jsonFail(403, "Admin role required") };
  }

  return { ok: true, decodedToken };
}

/**
 * Verify `Authorization: Bearer <Firebase ID token>` and require custom claim `role === "admin"`.
 */
export async function requireAdmin(
  request: Request,
  options: AdminApiAuthOptions = {},
): Promise<AdminSuccess | AdminAuthFailure> {
  const limited = applyRateLimitGate(request, options);
  if (limited) return limited;

  const auth = await authenticateAdminFromRequest(request);
  if (!auth.ok) return auth;

  return {
    ok: true,
    user: {
      uid: auth.decodedToken.uid,
      role: "admin",
      email: auth.decodedToken.email ?? null
    }
  };
}
