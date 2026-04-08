"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles, X } from "lucide-react";
import { AuthMethodTabs } from "@/components/auth/auth-method-tabs";
import { useToast } from "@/components/providers/toast-provider";

/** Distinct from full-page login (`recaptcha-container`) so two PhoneLoginForms never share one DOM id. */
const RECAPTCHA_ID = "recaptcha-container-modal";

type AuthLoginModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  fullPageLoginHref?: string;
};

export function AuthLoginModal({
  open,
  onOpenChange,
  title,
  description,
  fullPageLoginHref = "/login"
}: AuthLoginModalProps) {
  const { showToast } = useToast();
  const resolvedTitle = title ?? "Login to continue";
  const resolvedDescription = description ?? "Access your orders & faster checkout";
  const [formKey, setFormKey] = useState(0);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    if (open) setFormKey((k) => k + 1);
  }, [open]);

  useEffect(() => {
    if (!open) setAuthBusy(false);
  }, [open]);

  const handleSuccess = () => {
    showToast({
      title: "You're signed in",
      description: "Welcome back — happy ordering!"
    });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          />
        </Dialog.Overlay>

        <Dialog.Content asChild>
          <div className="fixed inset-0 z-[81] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              className="relative flex max-h-[min(90dvh,40rem)] w-[95%] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/15 outline-none transition-all duration-200 focus:outline-none dark:border-slate-700/80 dark:bg-slate-950 dark:shadow-black/40 sm:w-[400px] md:w-[420px]"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.85 }}
            >
              <div className="relative flex min-h-0 flex-1 flex-col">
                <AnimatePresence>
                  {authBusy ? (
                    <motion.div
                      key="auth-busy"
                      className="absolute inset-0 z-20 flex items-center justify-center rounded-inherit bg-white/80 backdrop-blur-sm dark:bg-slate-950/80"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      role="status"
                      aria-live="polite"
                      aria-label="Loading"
                    >
                      <Loader2 className="h-10 w-10 animate-spin text-orange-500" aria-hidden />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close"
                    className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-600 backdrop-blur-sm transition-all duration-200 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </Dialog.Close>

                <div className="border-b border-slate-100 px-4 pb-3 pt-12 dark:border-slate-800 sm:px-6 sm:pb-4 sm:pt-6">
                  <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Secure login
                  </div>
                  <Dialog.Title className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-xl md:text-2xl">
                    {resolvedTitle}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400 md:text-base">
                    {resolvedDescription}
                  </Dialog.Description>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-5">
                  <AuthMethodTabs
                    recaptchaContainerId={RECAPTCHA_ID}
                    formKey={formKey}
                    onSuccess={handleSuccess}
                    onAuthBusyChange={setAuthBusy}
                    authBusy={authBusy}
                    fullPageLoginHref={fullPageLoginHref}
                    showFullPageLink
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
