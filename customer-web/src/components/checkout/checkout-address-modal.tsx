"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Plus, X } from "lucide-react";
import Link from "next/link";
import { useDeliveryAddress } from "@/context/delivery-address-context";
import { useAuth } from "@/context/auth-context";
import { useUserProfile } from "@/context/user-profile-context";
import { useToast } from "@/components/providers/toast-provider";
import type { DeliveryAddressInput } from "@/lib/delivery-address-types";
import { withTimeout } from "@/lib/async-utils";

type CheckoutAddressModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, clicking the backdrop does nothing (use Back to cart instead). */
  requireSelection?: boolean;
};

function validateNewAddress(input: DeliveryAddressInput): Partial<Record<keyof DeliveryAddressInput, string>> {
  const e: Partial<Record<keyof DeliveryAddressInput, string>> = {};
  if (input.name.trim().length < 2) e.name = "Enter the recipient name.";
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) e.phone = "Enter a valid phone number.";
  if (input.addressLine.trim().length < 5) e.addressLine = "Enter a complete street / area.";
  if (input.city.trim().length < 2) e.city = "Enter city.";
  const pc = input.pincode.trim();
  if (!/^\d{6}$/.test(pc)) e.pincode = "Enter a 6-digit PIN code.";
  return e;
}

export function CheckoutAddressModal({ open, onOpenChange, requireSelection }: CheckoutAddressModalProps) {
  const { addresses, selectedId, selectAddress, addAddress, loading } = useDeliveryAddress();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { showToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlightRef = useRef(false);
  const [form, setForm] = useState<DeliveryAddressInput>({
    name: "",
    phone: "",
    addressLine: "",
    landmark: "",
    city: "",
    pincode: ""
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof DeliveryAddressInput, string>>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setShowForm(false);
      setFormMessage(null);
      setFormErrors({});
    }
  }, [open]);

  useEffect(() => {
    if (!open || !showForm || addresses.length > 0) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name || profile?.name || user?.displayName || "",
      phone: prev.phone || profile?.phone || user?.phoneNumber || ""
    }));
  }, [open, showForm, addresses.length, profile?.name, profile?.phone, user?.displayName, user?.phoneNumber]);

  const handleBackdrop = useCallback(() => {
    if (requireSelection) return;
    onOpenChange(false);
  }, [requireSelection, onOpenChange]);

  const handleConfirmSelection = useCallback(() => {
    if (!selectedId || !addresses.some((a) => a.id === selectedId)) return;
    onOpenChange(false);
  }, [addresses, onOpenChange, selectedId]);

  const SAVE_TIMEOUT_MS = 30_000;

  const handleSaveAddress = useCallback(async () => {
    if (saveInFlightRef.current) return;

    setFormMessage(null);
    const err = validateNewAddress(form);
    setFormErrors(err);
    if (Object.keys(err).length > 0) return;

    saveInFlightRef.current = true;
    setSaving(true);
    try {
      await withTimeout(addAddress(form), SAVE_TIMEOUT_MS, "Saving timed out. Check your connection and try again.");

      showToast({ title: "Address saved" });
      setForm({
        name: "",
        phone: "",
        addressLine: "",
        landmark: "",
        city: "",
        pincode: ""
      });
      setFormErrors({});
      setShowForm(false);
      onOpenChange(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not save address. Try again.";
      setFormMessage(msg);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [addAddress, form, onOpenChange, showToast]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !requireSelection) onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requireSelection, onOpenChange]);

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          key="checkout-address-modal"
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close address modal backdrop"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={handleBackdrop}
          />
          <div
            className="absolute inset-0 z-[1] flex items-end justify-center p-4 sm:items-center sm:p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleBackdrop();
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-address-modal-title"
              className="flex max-h-[min(88dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-md transition-all duration-200 dark:bg-slate-900 sm:w-[95%] sm:max-w-md sm:rounded-2xl md:w-[420px] hover:shadow-lg"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-orange-500" aria-hidden />
                <h2 id="checkout-address-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  Delivery address
                </h2>
              </div>
              {!requireSelection ? (
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {loading ? (
                <p className="text-sm text-slate-500">Loading addresses…</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Addresses are saved to your account and used at checkout.
                  </p>

                  {addresses.length > 0 ? (
                    <ul className="space-y-2" role="radiogroup" aria-label="Saved addresses">
                      {addresses.map((a) => {
                        const checked = selectedId === a.id;
                        return (
                          <li key={a.id}>
                            <label
                              className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${
                                checked
                                  ? "border-orange-400 bg-orange-50/80 dark:border-orange-700 dark:bg-orange-950/30"
                                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                              }`}
                            >
                              <input
                                type="radio"
                                name="delivery-address"
                                checked={checked}
                                onChange={() => selectAddress(a.id)}
                                className="mt-1"
                              />
                              <div className="min-w-0 text-sm">
                                <p className="font-semibold text-slate-900 dark:text-slate-50">{a.name}</p>
                                <p className="text-slate-600 dark:text-slate-300">{a.phone}</p>
                                <p className="mt-1 text-slate-600 dark:text-slate-400">
                                  {a.addressLine}
                                  {a.landmark ? ` · ${a.landmark}` : ""}
                                  {a.city ? ` · ${a.city}` : ""}
                                  {a.pincode ? ` · ${a.pincode}` : ""}
                                </p>
                                {a.isDefault ? (
                                  <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                                    Default
                                  </span>
                                ) : null}
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No saved addresses yet. Add one below.</p>
                  )}

                  {!showForm ? (
                    <button
                      type="button"
                      onClick={() => setShowForm(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-700 transition hover:border-orange-300 hover:bg-orange-50/50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-orange-800 dark:hover:bg-orange-950/20"
                    >
                      <Plus className="h-4 w-4" />
                      Add new address
                    </button>
                  ) : (
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">New address</p>
                      {[
                        ["name", "Full name", "text", "name"] as const,
                        ["phone", "Phone", "tel", "tel"] as const,
                        ["addressLine", "Street, area, flat no.", "text", "street-address"] as const,
                        ["landmark", "Landmark (optional)", "text", "off"] as const,
                        ["city", "City", "text", "address-level2"] as const,
                        ["pincode", "PIN code", "text", "postal-code"] as const
                      ].map(([key, label, type, auto]) => (
                        <div key={key}>
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                            {label}
                          </label>
                          <input
                            type={type}
                            inputMode={key === "phone" ? "tel" : key === "pincode" ? "numeric" : undefined}
                            autoComplete={auto}
                            value={form[key]}
                            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 sm:text-base"
                          />
                          {formErrors[key] ? <p className="mt-1 text-xs text-red-600">{formErrors[key]}</p> : null}
                        </div>
                      ))}
                      {formMessage ? <p className="text-xs text-red-600">{formMessage}</p> : null}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowForm(false);
                            setFormErrors({});
                          }}
                          className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium dark:border-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleSaveAddress()}
                          className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {saving ? "Saving…" : "Save & use"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-slate-200 p-3 dark:border-slate-800 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/cart"
                  className="order-2 flex w-full flex-1 items-center justify-center rounded-xl border border-slate-200 py-3 text-center text-sm font-medium transition-all duration-200 dark:border-slate-600 sm:order-1 sm:w-auto"
                >
                  Back to cart
                </Link>
                {addresses.length > 0 && selectedId && !showForm ? (
                  <button
                    type="button"
                    onClick={handleConfirmSelection}
                    className="order-1 w-full flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg sm:order-2 sm:w-auto"
                  >
                    Deliver here
                  </button>
                ) : null}
              </div>
            </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
