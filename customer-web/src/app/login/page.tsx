"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@shared/firebase/client";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const recaptchaContainerId = useMemo(() => "recaptcha-container", []);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Firebase returns a confirmation object with a `.confirm(code)` method.
  const confirmationRef = useRef<any>(null);

  async function sendOtp() {
    setLoading(true);
    setError(null);
    try {
      const normalizedPhone = phone.trim();
      if (!normalizedPhone) throw new Error("Please enter your phone number.");

      // Recaptcha container must exist in the DOM.
      if (!document.getElementById(recaptchaContainerId)) {
        throw new Error("reCAPTCHA container not found.");
      }

      const appVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
      const confirmationResult = await signInWithPhoneNumber(auth, normalizedPhone, appVerifier);
      confirmationRef.current = confirmationResult;
      setStep("otp");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to send OTP.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setError(null);
    try {
      if (!confirmationRef.current) throw new Error("OTP session expired. Please resend.");
      const code = otp.trim();
      if (!code) throw new Error("Please enter the OTP code.");

      await confirmationRef.current.confirm(code);
      router.push("/profile");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to verify OTP.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <h1 className="text-3xl font-bold">Login</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Use your phone number to receive an OTP.
      </p>

      <div className="rounded-2xl border bg-white p-5 shadow-md dark:border-slate-700 dark:bg-slate-900">
        {/* Required for Firebase phone auth */}
        <div id={recaptchaContainerId} className="hidden" />

        {step === "phone" ? (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Phone number
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9XXXXXXXXX"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              disabled={loading}
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <button
              onClick={() => void sendOtp()}
              disabled={loading || !phone.trim()}
              className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Enter OTP
            </label>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6 digit code"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              disabled={loading}
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <button
              onClick={() => void verifyOtp()}
              disabled={loading || !otp.trim()}
              className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError(null);
              }}
              disabled={loading}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Change phone
            </button>
            <button
              onClick={() => void sendOtp()}
              disabled={loading || !phone.trim()}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Resend OTP
            </button>
          </>
        )}
      </div>
    </section>
  );
}

