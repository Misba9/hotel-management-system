"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/providers/toast-provider";
import { mapFirebaseAuthError } from "@/lib/firebase-auth-errors";

const MIN_PASSWORD_LEN = 6;

/** Practical email shape check (Firebase also validates). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

type EmailLoginFormProps = {
  onSuccess?: () => void;
  onAuthBusyChange?: (busy: boolean) => void;
};

type FieldErrors = {
  email?: string;
  password?: string;
  confirm?: string;
};

function mapAuthError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
    switch (code) {
      case "auth/invalid-email":
        return "That email doesn’t look valid. Check for typos.";
      case "auth/user-disabled":
        return "This account has been disabled. Contact support if you need help.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Wrong email or password. Try again or create an account.";
      case "auth/email-already-in-use":
        return "An account already exists with this email. Switch to Login.";
      case "auth/weak-password":
        return `Choose a stronger password (at least ${MIN_PASSWORD_LEN} characters).`;
      case "auth/too-many-requests":
        return "Too many attempts. Wait a few minutes and try again.";
      case "auth/operation-not-allowed":
        return "Email sign-in isn’t enabled for this app. Ask an administrator.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        break;
    }
  }
  return mapFirebaseAuthError(error, "Something went wrong. Please try again.");
}

function validateFields(
  email: string,
  password: string,
  confirm: string,
  mode: "signin" | "signup"
): FieldErrors {
  const e = email.trim();
  const errors: FieldErrors = {};

  if (!e) {
    errors.email = "Enter your email address.";
  } else if (!EMAIL_REGEX.test(e)) {
    errors.email = "Use a valid email format (e.g. name@example.com).";
  }

  if (!password) {
    errors.password = "Enter your password.";
  } else if (password.length < MIN_PASSWORD_LEN) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LEN} characters.`;
  }

  if (mode === "signup") {
    if (password !== confirm) {
      errors.confirm = "Passwords must match.";
    }
  }

  return errors;
}

export function EmailLoginForm({ onSuccess, onAuthBusyChange }: EmailLoginFormProps) {
  const { showToast } = useToast();
  const uid = useId();
  const idEmail = `email-auth-${uid}-email`;
  const idPassword = `email-auth-${uid}-password`;
  const idConfirm = `email-auth-${uid}-confirm`;
  const idErrEmail = `${idEmail}-err`;
  const idErrPassword = `${idPassword}-err`;
  const idHintPassword = `${idPassword}-hint`;
  const idErrConfirm = `${idConfirm}-err`;

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    onAuthBusyChange?.(loading);
  }, [loading, onAuthBusyChange]);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setAuthError(null);
  }, []);

  const switchMode = useCallback(
    (next: "signin" | "signup") => {
      setMode(next);
      clearErrors();
      if (next === "signin") setConfirm("");
    },
    [clearErrors]
  );

  async function submit() {
    const trimmedEmail = email.trim();
    const clientErrors = validateFields(trimmedEmail, password, confirm, mode);
    setFieldErrors(clientErrors);
    setAuthError(null);

    if (Object.keys(clientErrors).length > 0) return;

    setLoading(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
      onSuccess?.();
    } catch (err) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      showToast({
        type: "error",
        title: mode === "signup" ? "Couldn’t create account" : "Sign-in failed",
        description: msg
      });
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:ring-2 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-base";
  const inputOk =
    "border-slate-200/90 focus:border-orange-400 focus:ring-orange-500/20 dark:border-slate-600 dark:focus:border-orange-500";
  const inputErr =
    "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-800 dark:focus:border-red-500";

  const toggleClass =
    "relative z-0 flex-1 rounded-lg py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500";

  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100/95 p-1 dark:bg-slate-900/80"
        role="tablist"
        aria-label="Login or sign up"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => switchMode("signin")}
          disabled={loading}
          className={`${toggleClass} ${
            mode === "signin"
              ? "bg-white text-orange-600 shadow-sm dark:bg-slate-900 dark:text-orange-400"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => switchMode("signup")}
          disabled={loading}
          className={`${toggleClass} ${
            mode === "signup"
              ? "bg-white text-orange-600 shadow-sm dark:bg-slate-900 dark:text-orange-400"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Sign up
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400" htmlFor={idEmail}>
          Email
        </label>
        <input
          id={idEmail}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(ev) => {
            setEmail(ev.target.value);
            setFieldErrors((fe) => ({ ...fe, email: undefined }));
            setAuthError(null);
          }}
          placeholder="you@example.com"
          disabled={loading}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? idErrEmail : undefined}
          className={`${inputBase} ${fieldErrors.email ? inputErr : inputOk}`}
        />
        {fieldErrors.email ? (
          <p id={idErrEmail} className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label
          className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
          htmlFor={idPassword}
        >
          Password
        </label>
        <input
          id={idPassword}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(ev) => {
            setPassword(ev.target.value);
            setFieldErrors((fe) => ({ ...fe, password: undefined }));
            setAuthError(null);
          }}
          placeholder="••••••••"
          disabled={loading}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={
            fieldErrors.password ? idErrPassword : mode === "signup" ? idHintPassword : undefined
          }
          className={`${inputBase} ${fieldErrors.password ? inputErr : inputOk}`}
        />
        {fieldErrors.password ? (
          <p id={idErrPassword} className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {fieldErrors.password}
          </p>
        ) : mode === "signup" ? (
          <p id={idHintPassword} className="text-xs text-slate-500 dark:text-slate-500">
            At least {MIN_PASSWORD_LEN} characters
          </p>
        ) : null}
      </div>

      {mode === "signup" ? (
        <div className="space-y-1.5">
          <label
            className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
            htmlFor={idConfirm}
          >
            Confirm password
          </label>
          <input
            id={idConfirm}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(ev) => {
              setConfirm(ev.target.value);
              setFieldErrors((fe) => ({ ...fe, confirm: undefined }));
              setAuthError(null);
            }}
            placeholder="••••••••"
            disabled={loading}
            aria-invalid={Boolean(fieldErrors.confirm)}
            aria-describedby={fieldErrors.confirm ? idErrConfirm : undefined}
            className={`${inputBase} ${fieldErrors.confirm ? inputErr : inputOk}`}
          />
          {fieldErrors.confirm ? (
            <p id={idErrConfirm} className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
              {fieldErrors.confirm}
            </p>
          ) : null}
        </div>
      ) : null}

      {authError ? (
        <div
          className="flex gap-2 rounded-xl border border-red-200/90 bg-red-50/95 px-3 py-2.5 dark:border-red-900/50 dark:bg-red-950/35"
          role="alert"
        >
          <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
          <p className="text-sm leading-snug text-red-800 dark:text-red-200">{authError}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading || !email.trim() || !password || (mode === "signup" && !confirm)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition hover:from-orange-600 hover:to-amber-600 disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {loading
          ? mode === "signup"
            ? "Creating account…"
            : "Signing in…"
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </button>
    </div>
  );
}
