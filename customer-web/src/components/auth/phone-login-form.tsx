"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { signInWithPhoneNumber } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { OtpInput6 } from "@/components/auth/otp-input-6";
import { useToast } from "@/components/providers/toast-provider";
import {
  getOrCreatePhoneRecaptchaVerifier,
  logPhoneAuthEvent,
  logPhoneAuthDebug,
  resetPhoneRecaptchaVerifier
} from "@/lib/firebase-phone-recaptcha";
import { mapPhoneAuthError } from "@/lib/phone-auth-errors";
import { reportOtpServerLog } from "@/lib/phone-otp-client-log";

const OTP_LENGTH = 6;

/** Firebase expects E.164. Ten-digit local numbers default to +91 (configure test numbers in Firebase Console). */
function normalizePhoneE164(raw: string): string {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 0) return `+${digits}`;
  return "";
}

function authErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code ?? "");
  }
  return "";
}

type PhoneLoginFormProps = {
  /** Must match a real element in the DOM; default is `recaptcha-container` (see hidden div below). */
  recaptchaContainerId?: string;
  onSuccess?: () => void;
  variant?: "card" | "plain";
  onAuthBusyChange?: (busy: boolean) => void;
};

const stepMotion = {
  initial: { opacity: 0, x: 14 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }
};

const recaptchaHostClass =
  "pointer-events-none fixed bottom-0 left-0 z-[2] h-px w-px overflow-hidden opacity-0";

export function PhoneLoginForm({
  recaptchaContainerId = "recaptcha-container",
  onSuccess,
  variant = "card",
  onAuthBusyChange
}: PhoneLoginFormProps) {
  const { showToast } = useToast();
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const verifyAttemptRef = useRef(false);
  const [otpRemountKey, setOtpRemountKey] = useState(0);

  const clearVerifier = useCallback(() => {
    verifierRef.current = null;
    resetPhoneRecaptchaVerifier();
  }, []);

  useEffect(() => () => clearVerifier(), [clearVerifier]);

  useEffect(() => {
    onAuthBusyChange?.(Boolean(loading && step === "otp"));
  }, [loading, step, onAuthBusyChange]);

  const otpString = digits.join("");

  const resetOtpDigits = useCallback(() => {
    setDigits(Array(OTP_LENGTH).fill(""));
    verifyAttemptRef.current = false;
  }, []);

  const handleOtpDigitsChange = useCallback((next: string[]) => {
    setError(null);
    verifyAttemptRef.current = false;
    setDigits(next);
  }, []);

  const sendOtp = useCallback(async () => {
    setLoading(true);
    setError(null);
    verifyAttemptRef.current = false;
    try {
      const e164 = normalizePhoneE164(phone);
      if (!e164 || e164.length < 8) throw new Error("Enter a valid phone number with country code.");

      const el = document.getElementById(recaptchaContainerId);
      if (!el) {
        logPhoneAuthEvent("error", "recaptcha container missing in DOM", { recaptchaContainerId });
        reportOtpServerLog({ phase: "recaptcha", message: `missing #${recaptchaContainerId}` });
        throw new Error(`reCAPTCHA container #${recaptchaContainerId} not found.`);
      }

      /** Resend / new SMS: need a fresh invisible widget; first send reuses `window.recaptchaVerifier`. */
      if (step === "otp") {
        resetPhoneRecaptchaVerifier();
        logPhoneAuthEvent("info", "reset recaptcha before resend");
      }

      logPhoneAuthDebug("getOrCreatePhoneRecaptchaVerifier before signInWithPhoneNumber");
      const appVerifier = await getOrCreatePhoneRecaptchaVerifier(auth, recaptchaContainerId);
      verifierRef.current = appVerifier;

      const confirmationResult = await signInWithPhoneNumber(auth, e164, appVerifier);
      logPhoneAuthEvent("info", "signInWithPhoneNumber started");
      logPhoneAuthDebug("signInWithPhoneNumber SMS flow started");

      confirmationRef.current = confirmationResult;
      resetOtpDigits();
      setStep("otp");
    } catch (e) {
      const code = authErrorCode(e);
      logPhoneAuthEvent("error", "sendOtp failed", {
        code,
        message: e instanceof Error ? e.message : String(e)
      });
      reportOtpServerLog({
        phase: "send",
        firebaseErrorCode: code || undefined,
        message: e instanceof Error ? e.message : String(e)
      });
      const msg = mapPhoneAuthError(e, "send");
      setError(msg);
      showToast({ type: "error", title: "Couldn’t send OTP", description: msg });
      resetPhoneRecaptchaVerifier();
    } finally {
      setLoading(false);
    }
  }, [phone, recaptchaContainerId, resetOtpDigits, showToast, step]);

  const verifyOtp = useCallback(async () => {
    const code = digits.join("");
    if (code.length !== OTP_LENGTH) {
      setError("Enter all 6 digits.");
      return;
    }
    if (verifyAttemptRef.current) return;
    verifyAttemptRef.current = true;

    setLoading(true);
    setError(null);
    try {
      if (!confirmationRef.current) {
        throw new Error("Session expired. Resend OTP.");
      }
      await confirmationRef.current.confirm(code);
      clearVerifier();
      confirmationRef.current = null;
      onSuccess?.();
    } catch (e) {
      verifyAttemptRef.current = false;
      const errCode = authErrorCode(e);
      logPhoneAuthEvent("error", "verifyOtp failed", {
        code: errCode,
        message: e instanceof Error ? e.message : String(e)
      });
      reportOtpServerLog({
        phase: "verify",
        firebaseErrorCode: errCode || undefined,
        message: e instanceof Error ? e.message : String(e)
      });
      logPhoneAuthDebug("verifyOtp error", { code: errCode, message: e instanceof Error ? e.message : e });
      const msg = mapPhoneAuthError(e, "verify");
      setError(msg);
      showToast({ type: "error", title: "Verification failed", description: msg });
      resetOtpDigits();
      setOtpRemountKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }, [digits, onSuccess, clearVerifier, resetOtpDigits, showToast]);

  useEffect(() => {
    if (step !== "otp" || loading) return;
    if (otpString.length !== OTP_LENGTH) return;
    void verifyOtp();
  }, [otpString, step, loading, verifyOtp]);

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-orange-500 sm:text-base";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
  const secondaryBtn =
    "mt-2 flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
  const primaryBtn =
    "mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition hover:from-orange-600 hover:to-amber-600 disabled:pointer-events-none disabled:opacity-50";

  const shell =
    variant === "card"
      ? "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md dark:border-slate-700 dark:bg-slate-900"
      : "space-y-0";

  /** Root layout provides `#recaptcha-container`; modal uses a dedicated id to avoid duplicates. */
  const showInlineRecaptchaHost = recaptchaContainerId !== "recaptcha-container";

  return (
    <div className={shell}>
      {showInlineRecaptchaHost ? (
        <div id={recaptchaContainerId} className={recaptchaHostClass} aria-hidden />
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {step === "phone" ? (
          <motion.div key="phone-step" {...stepMotion} className="space-y-0">
            <label className={labelClass} htmlFor={`${recaptchaContainerId}-phone`}>
              Phone number
            </label>
            <input
              id={`${recaptchaContainerId}-phone`}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9059899298"
              className={inputClass}
              disabled={loading}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-500">
           
            </p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-500">
              Test OTP setup (Firebase test phone): <strong>9059899298</strong> with code <strong>123456</strong>.
            </p>
            {error ? (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            ) : null}
            <button type="button" onClick={() => void sendOtp()} disabled={loading || !phone.trim()} className={primaryBtn}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send OTP"
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div key="otp-step" {...stepMotion} className="space-y-0">
            <label className={labelClass} htmlFor={`${recaptchaContainerId}-otp-0`}>
              Enter 6-digit OTP
            </label>
            <div className="mt-2">
              <OtpInput6
                key={otpRemountKey}
                idPrefix={`${recaptchaContainerId}`}
                digits={digits}
                onDigitsChange={handleOtpDigitsChange}
                disabled={loading}
              />
            </div>
            {error ? (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void verifyOtp()}
              disabled={loading || otpString.length !== OTP_LENGTH}
              className={primaryBtn}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Verifying…
                </>
              ) : (
                "Verify OTP"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                resetOtpDigits();
                setError(null);
                confirmationRef.current = null;
                clearVerifier();
              }}
              disabled={loading}
              className={secondaryBtn}
            >
              Change phone
            </button>
            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={loading || !phone.trim()}
              className={secondaryBtn}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </span>
              ) : (
                "Resend OTP"
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
