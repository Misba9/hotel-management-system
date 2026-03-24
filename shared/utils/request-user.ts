import { adminAuth } from "@shared/firebase/admin";

const GUEST_ID_HEADER = "x-guest-id";
const GUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,80}$/;

export type RequestUser = {
  userId: string;
  isAuthenticated: boolean;
};

export class RequestUserAuthError extends Error {}

export async function resolveRequestUser(request: Request): Promise<RequestUser> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new RequestUserAuthError("Missing bearer token.");
    }
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      throw new RequestUserAuthError("Invalid bearer token.");
    }
    return {
      userId: decoded.uid,
      isAuthenticated: true
    };
  }

  const guestId = request.headers.get(GUEST_ID_HEADER)?.trim() ?? "";
  if (guestId && GUEST_ID_REGEX.test(guestId)) {
    return {
      userId: `guest:${guestId}`,
      isAuthenticated: false
    };
  }

  return {
    userId: "guest:anonymous",
    isAuthenticated: false
  };
}

export async function resolveAuthenticatedRequestUser(request: Request): Promise<RequestUser> {
  const user = await resolveRequestUser(request);
  if (!user.isAuthenticated) {
    throw new RequestUserAuthError("Missing authenticated user.");
  }
  return user;
}
