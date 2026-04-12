"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthError } from "firebase/auth";
import { Loader2, Lock, Mail } from "lucide-react";
import { routeForRole, useAuth } from "@/context/AuthContext";
import { FirebaseConfigErrorPanel } from "@/components/auth/firebase-config-error-panel";

function mapAuthError(err: unknown): string {
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as AuthError).code) : "";
  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid":
      return (
        "Invalid API key. Copy the Web API key from Firebase Console → Project settings → Your apps, " +
        "set NEXT_PUBLIC_FIREBASE_API_KEY in admin-dashboard/.env.local, restart dev. " +
        "In Google Cloud → Credentials, ensure the Browser key allows http://localhost:3001/* (or your port)."
      );
    case "auth/configuration-not-found":
    case "auth/invalid-app-credential":
      return "Firebase app configuration is wrong or the Auth service is disabled. Enable Email/Password under Authentication → Sign-in method, and verify all NEXT_PUBLIC_FIREBASE_* values match one Web app."
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      if (err instanceof Error && err.message) return err.message;
      return "Could not sign in. Please try again.";
  }
}

function validateEmail(email: string): string | null {
  const t = email.trim();
  if (!t) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Enter a valid email address.";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

type Props = {
  /** From `ADMIN_DEMO_EMAIL` — create the same user in Firebase Auth */
  defaultEmail?: string;
  /** From `ADMIN_DEMO_PASSWORD` — for local/demo pre-fill only */
  defaultPassword?: string;
};

export function LoginForm({ defaultEmail = "", defaultPassword = "" }: Props) {
  const router = useRouter();
  const { user, role, initializing, authClaimsResolved, login, firebaseConfigError } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initializing) return;
    if (user && authClaimsResolved) {
      router.replace(routeForRole(role));
    }
  }, [user, role, initializing, authClaimsResolved, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    if (eErr || pErr) {
      setFieldErrors({ email: eErr ?? undefined, password: pErr ?? undefined });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setSubmitError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (initializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-primary" aria-hidden />
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (firebaseConfigError) {
    return <FirebaseConfigErrorPanel message={firebaseConfigError} />;
  }

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Redirecting…
      </div>
    );
  }

  const hasDemo = Boolean(defaultEmail || defaultPassword);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">NFJC</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Admin sign in</h1>
            <p className="mt-1 text-sm text-slate-600">Use your admin email and password</p>
            {hasDemo ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200/80">
                Demo fields pre-filled from <code className="rounded bg-white/80 px-1">ADMIN_DEMO_EMAIL</code> /{" "}
                <code className="rounded bg-white/80 px-1">ADMIN_DEMO_PASSWORD</code>. Create this user in Firebase
                Authentication.
              </p>
            ) : null}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {submitError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {submitError}
                </div>
              ) : null}

              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none ring-brand-primary/20 placeholder:text-slate-400 focus:border-brand-primary focus:ring-2"
                    placeholder="you@example.com"
                    disabled={submitting}
                  />
                </div>
                {fieldErrors.email ? <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p> : null}
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none ring-brand-primary/20 placeholder:text-slate-400 focus:border-brand-primary focus:ring-2"
                    placeholder="••••••••"
                    disabled={submitting}
                  />
                </div>
                {fieldErrors.password ? <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p> : null}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">Nausheen Fruits Juice Center · Admin</p>
        </div>
      </div>
    </div>
  );
}
