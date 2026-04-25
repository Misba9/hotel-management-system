"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthMethodTabs } from "@/components/auth/auth-method-tabs";
import { useToast } from "@/components/providers/toast-provider";

function safePostLoginPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/profile";
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [redirectPath, setRedirectPath] = useState("/profile");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectPath(safePostLoginPath(params.get("redirect")));
  }, []);

  return (
    <section className="mx-auto w-full max-w-md space-y-6 px-1 sm:px-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">Login</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Sign in with phone (OTP), email, Google, or Apple. Enable each provider in Firebase Console → Authentication.
        </p>
      </div>
      <AuthMethodTabs
        recaptchaContainerId="recaptcha-container"
        onSuccess={() => {
          showToast({ title: "You're signed in", description: "Redirecting…" });
          router.push(redirectPath);
        }}
      />
    </section>
  );
}
