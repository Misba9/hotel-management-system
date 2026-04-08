import { adminAuth } from "@shared/firebase/admin";

export type RequestUser = {
  userId: string;
  isAuthenticated: boolean;
};

export class RequestUserAuthError extends Error {}

/** Resolves the caller from a valid Firebase ID token only (no guest / anonymous IDs). */
export async function resolveRequestUser(request: Request): Promise<RequestUser> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new RequestUserAuthError("Authentication required.");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new RequestUserAuthError("Authentication required.");
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      userId: decoded.uid,
      isAuthenticated: true
    };
  } catch {
    throw new RequestUserAuthError("Invalid or expired token.");
  }
}

export async function resolveAuthenticatedRequestUser(request: Request): Promise<RequestUser> {
  const user = await resolveRequestUser(request);
  if (!user.isAuthenticated) {
    throw new RequestUserAuthError("Missing authenticated user.");
  }
  return user;
}
