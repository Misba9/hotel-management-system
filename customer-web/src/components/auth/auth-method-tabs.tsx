"use client";

import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import { Mail, Smartphone } from "lucide-react";
import { AppleSignInPanel } from "@/components/auth/apple-sign-in-panel";
import { EmailLoginForm } from "@/components/auth/email-login-form";
import { GoogleMark } from "@/components/auth/google-mark";
import { GoogleSignInPanel } from "@/components/auth/google-sign-in-panel";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";

const tabTriggerClass =
  "inline-flex min-w-[4.75rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-2 py-2.5 text-xs font-semibold text-slate-500 outline-none transition-all duration-200 data-[state=active]:border-orange-200/80 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-md dark:text-slate-400 dark:data-[state=active]:border-orange-900/40 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-orange-400 sm:min-w-0 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm";

type AuthMethodTabsProps = {
  /** Default `recaptcha-container`. Use a different id for the auth modal if the login page can mount at the same time. */
  recaptchaContainerId?: string;
  onSuccess: () => void;
  onAuthBusyChange?: (busy: boolean) => void;
  /** Increment to reset tab state (e.g. when modal reopens). */
  formKey?: number;
  fullPageLoginHref?: string;
  showFullPageLink?: boolean;
  authBusy?: boolean;
};

export function AuthMethodTabs({
  recaptchaContainerId = "recaptcha-container",
  onSuccess,
  onAuthBusyChange,
  formKey = 0,
  fullPageLoginHref = "/login",
  showFullPageLink = false,
  authBusy = false
}: AuthMethodTabsProps) {
  return (
    <Tabs.Root key={`auth-tabs-${formKey}`} defaultValue="phone" className="w-full">
      <Tabs.List
        className={`flex flex-wrap justify-center gap-2 rounded-xl bg-slate-100/95 p-2 transition-all duration-200 dark:bg-slate-900/80 ${
          authBusy ? "pointer-events-none opacity-50" : ""
        }`}
        aria-label="Sign-in method"
      >
        <Tabs.Trigger value="phone" className={tabTriggerClass} disabled={authBusy}>
          <Smartphone className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span>Phone</span>
        </Tabs.Trigger>
        <Tabs.Trigger value="email" className={tabTriggerClass} disabled={authBusy}>
          <Mail className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span>Email</span>
        </Tabs.Trigger>
        <Tabs.Trigger value="google" className={tabTriggerClass} disabled={authBusy}>
          <GoogleMark className="h-4 w-4 shrink-0" />
          <span>Google</span>
        </Tabs.Trigger>
        <Tabs.Trigger value="apple" className={tabTriggerClass} disabled={authBusy}>
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
            />
          </svg>
          <span>Apple</span>
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content
        value="phone"
        className="mt-4 outline-none transition-opacity duration-200 data-[state=inactive]:hidden sm:mt-5"
      >
        <PhoneLoginForm
          recaptchaContainerId={recaptchaContainerId}
          variant="plain"
          onSuccess={onSuccess}
          onAuthBusyChange={onAuthBusyChange}
        />
      </Tabs.Content>

      <Tabs.Content
        value="email"
        className="mt-4 outline-none transition-opacity duration-200 data-[state=inactive]:hidden sm:mt-5"
      >
        <EmailLoginForm onSuccess={onSuccess} onAuthBusyChange={onAuthBusyChange} />
      </Tabs.Content>

      <Tabs.Content
        value="google"
        className="mt-4 outline-none transition-opacity duration-200 data-[state=inactive]:hidden sm:mt-5"
      >
        <GoogleSignInPanel onSuccess={onSuccess} onAuthBusyChange={onAuthBusyChange} />
      </Tabs.Content>

      <Tabs.Content
        value="apple"
        className="mt-4 outline-none transition-opacity duration-200 data-[state=inactive]:hidden sm:mt-5"
      >
        <AppleSignInPanel onSuccess={onSuccess} onAuthBusyChange={onAuthBusyChange} />
      </Tabs.Content>

      {showFullPageLink ? (
        <p className="mt-5 border-t border-slate-100 pt-3 text-center text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-500 sm:mt-6 sm:pt-4 sm:text-xs">
          Prefer the full page?{" "}
          <Link
            href={fullPageLoginHref}
            className="font-semibold text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
          >
            Open login
          </Link>
        </p>
      ) : null}
    </Tabs.Root>
  );
}
