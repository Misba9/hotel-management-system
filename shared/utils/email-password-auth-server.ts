import type { Auth } from "firebase-admin/auth";
import { z } from "zod";
import { adminAuth } from "../../backend/firebase/admin";
import { isDuplicateAuthAttempt } from "./auth-request-dedupe";
import { consumeRateLimit } from "./api-security";
import { verifyRecaptchaV3Token } from "./recaptcha-verify";

const bodySchema = z.object({
  mode: z.enum(["login", "signup", "admin_login"]),
  email: z.string().email().max(320),
  password: z.string().min(6).max(4096),
  recaptchaToken: z.string().min(1).max(4000),
  /** Honeypot — must be empty (bots often fill hidden fields). */
  website: z.string().max(500).optional()
});

export type EmailAuthAllowedModes = "login" | "signup" | "admin_login";

function recaptchaActionForMode(mode: EmailAuthAllowedModes): string {
  switch (mode) {
    case "signup":
      return "signup";
    case "admin_login":
      return "admin_login";
    default:
      return "login";
  }
}

function getFirebaseWebApiKey(): string | null {
  return (
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    null
  );
}

async function identityToolkitSignIn(email: string, password: string): Promise<string> {
  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error("Server misconfiguration: Firebase Web API key is not set.");
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = (await res.json()) as {
    localId?: string;
    error?: { message?: string; errors?: { message: string }[] };
  };
  if (!res.ok || !data.localId) {
    const code = data.error?.message ?? "UNKNOWN";
    throw new IdentityToolkitAuthError(code);
  }
  return data.localId;
}

class IdentityToolkitAuthError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "IdentityToolkitAuthError";
    this.code = code;
  }
}

function mapIdentityErrorToMessage(code: string): string {
  switch (code) {
    case "EMAIL_NOT_FOUND":
    case "INVALID_PASSWORD":
    case "INVALID_LOGIN_CREDENTIALS":
      return "Invalid email or password.";
    case "USER_DISABLED":
      return "This account has been disabled.";
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return "Too many attempts. Try again later.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

function mapAdminCreateUserError(err: unknown): string {
  const any = err as { code?: string; message?: string };
  if (any?.code === "auth/email-already-exists") {
    return "An account already exists with this email. Try signing in instead.";
  }
  if (any?.code === "auth/invalid-email") {
    return "That email address is not valid.";
  }
  if (any?.code === "auth/weak-password") {
    return "Password is too weak.";
  }
  return "Could not create account. Please try again.";
}

export type HandleEmailAuthOptions = {
  /** Which modes this endpoint accepts (e.g. customer route excludes `admin_login`). */
  allowedModes: readonly EmailAuthAllowedModes[];
  /** Prefix for rate-limit keys (separate customer vs admin routes). */
  rateLimitKeyPrefix: string;
};

/**
 * Shared POST handler: reCAPTCHA v3, rate limit, honeypot, then Firebase email/password → custom token.
 */
export async function handleEmailPasswordAuthPost(
  request: Request,
  auth: Auth,
  options: HandleEmailAuthOptions,
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const limited = consumeRateLimit(request, {
    keyPrefix: options.rateLimitKeyPrefix,
    limit: 5,
    windowMs: 60_000
  });
  if (limited) {
    return Response.json({ error: "Too many attempts. Please wait a minute and try again." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  if (!options.allowedModes.includes(body.mode)) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  const honeypot = body.website?.trim() ?? "";
  if (honeypot.length > 0) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();

  if (isDuplicateAuthAttempt(request, email, body.mode)) {
    return Response.json({ error: "Duplicate request." }, { status: 429 });
  }

  const expectedAction = recaptchaActionForMode(body.mode);
  const captcha = await verifyRecaptchaV3Token(body.recaptchaToken, expectedAction);
  if (!captcha.ok) {
    const msg =
      captcha.reason === "config"
        ? "Security verification is not configured."
        : "Security check failed. Refresh the page and try again.";
    return Response.json({ error: msg }, { status: captcha.reason === "config" ? 503 : 403 });
  }

  try {
    let uid: string;

    if (body.mode === "signup") {
      const user = await auth.createUser({
        email,
        password: body.password,
        emailVerified: false
      });
      uid = user.uid;
    } else {
      try {
        uid = await identityToolkitSignIn(email, body.password);
      } catch (e) {
        if (e instanceof IdentityToolkitAuthError) {
          return Response.json(
            { error: mapIdentityErrorToMessage(e.code) },
            { status: 401 },
          );
        }
        throw e;
      }
    }

    const customToken = await auth.createCustomToken(uid);
    return Response.json({ customToken });
  } catch (err) {
    if (body.mode === "signup") {
      return Response.json({ error: mapAdminCreateUserError(err) }, { status: 400 });
    }
    if (err instanceof IdentityToolkitAuthError) {
      return Response.json({ error: mapIdentityErrorToMessage(err.code) }, { status: 401 });
    }
    console.error("[email-password-auth]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/** Convenience wrapper using the shared Admin `auth` instance. */
export async function handleEmailPasswordAuthPostWithDefaultAdmin(
  request: Request,
  options: HandleEmailAuthOptions,
): Promise<Response> {
  return handleEmailPasswordAuthPost(request, adminAuth, options);
}
