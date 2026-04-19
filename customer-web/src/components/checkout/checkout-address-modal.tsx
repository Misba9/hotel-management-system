"use client";

import { FirebaseError } from "firebase/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Navigation, Plus, X } from "lucide-react";
import Link from "next/link";
import { useDeliveryAddress } from "@/context/delivery-address-context";
import { useAuth } from "@/context/auth-context";
import { useUserProfile } from "@/context/user-profile-context";
import { useToast } from "@/components/providers/toast-provider";
import { CheckoutAddressPlacesSearch } from "@/components/checkout/checkout-address-places-search";
import { isGoogleMapsConfigured } from "@/components/providers/google-maps-script";
import { formatDistanceKm, sortAddressesSmart } from "@/lib/address-suggestions";
import { getDistanceKm } from "@/lib/geo-distance";
import type { DeliveryAddress, DeliveryAddressInput, SavedAddressLabel } from "@/lib/delivery-address-types";

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

function formToTempDelivery(uid: string, input: DeliveryAddressInput): DeliveryAddress {
  const label = (input.label ?? "Home") as SavedAddressLabel;
  const now = new Date().toISOString();
  return {
    id: `temp-${Date.now()}`,
    userId: uid,
    label,
    name: input.name.trim(),
    phone: input.phone.trim(),
    addressLine: input.addressLine.trim(),
    landmark: input.landmark.trim(),
    city: input.city.trim(),
    pincode: input.pincode.trim(),
    ...(typeof input.lat === "number" && Number.isFinite(input.lat) ? { lat: input.lat } : {}),
    ...(typeof input.lng === "number" && Number.isFinite(input.lng) ? { lng: input.lng } : {}),
    isDefault: false,
    createdAt: now,
    updatedAt: now
  };
}

export function CheckoutAddressModal({ open, onOpenChange, requireSelection }: CheckoutAddressModalProps) {
  const {
    addresses,
    lastUsedAddressId,
    selectedId,
    selectAddress,
    addAddress,
    loading,
    checkoutDraftAddress,
    setCheckoutDraftAddress,
    isSelectedAddressSynced
  } = useDeliveryAddress();
  const { user } = useAuth();
  /** Same source as `addresses` in context — embedded on `users/{uid}.addresses`. */
  const { profile } = useUserProfile();
  const { showToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Prevents double submit before React re-renders `saving`. */
  const saveInFlightRef = useRef(false);
  const [form, setForm] = useState<DeliveryAddressInput>({
    label: "Home",
    name: "",
    phone: "",
    addressLine: "",
    landmark: "",
    city: "",
    pincode: ""
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof DeliveryAddressInput, string>>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "loading" | "ok" | "unavailable">("idle");

  const savedAddresses = profile?.addresses ?? addresses;

  const suggestedAddresses = useMemo(
    () => sortAddressesSmart(savedAddresses, userLoc),
    [savedAddresses, userLoc]
  );

  useEffect(() => {
    if (!open) {
      setLocStatus("idle");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUserLoc(null);
      setLocStatus("unavailable");
      return;
    }
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("ok");
      },
      () => {
        setUserLoc(null);
        setLocStatus("unavailable");
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 12_000 }
    );
  }, [open]);

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
    if (!selectedId) return;
    const inSaved = savedAddresses.some((a) => a.id === selectedId);
    const inDraft = checkoutDraftAddress?.id === selectedId;
    if (!inSaved && !inDraft) return;
    onOpenChange(false);
  }, [savedAddresses, checkoutDraftAddress?.id, onOpenChange, selectedId]);

  const resetFormAfterSave = useCallback(() => {
    setForm({
      label: "Home",
      name: "",
      phone: "",
      addressLine: "",
      landmark: "",
      city: "",
      pincode: ""
    });
    setFormErrors({});
    setFormMessage(null);
    setShowForm(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSaveAddress = useCallback(async () => {
    if (saving || saveInFlightRef.current) return;
    if (!user?.uid) {
      window.alert("User not logged in");
      return;
    }

    console.log("USER ID:", user?.uid);
    console.log(form.addressLine, form.city, form.pincode);

    setFormMessage(null);
    const err = validateNewAddress(form);
    setFormErrors(err);
    if (Object.keys(err).length > 0) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      saveInFlightRef.current = true;
      showToast({
        title: "You are offline",
        description: "Using this address for checkout. It will sync to your account when you are back online.",
        type: "warning"
      });
      const tempAddress = formToTempDelivery(user.uid, form);
      setCheckoutDraftAddress(tempAddress);
      resetFormAfterSave();
      saveInFlightRef.current = false;
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);

    try {
      await addAddress(form);
      showToast({ title: "Address saved", type: "success" });
      resetFormAfterSave();
    } catch (err) {
      console.error("Save failed:", err);
      const msg =
        err instanceof FirebaseError
          ? err.code === "permission-denied"
            ? "Permission denied. Sign out and sign in again, then retry."
            : err.code === "unavailable"
              ? "Firestore is temporarily unavailable. Check your connection."
              : err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      showToast({
        type: "error",
        title: "Could not save address",
        description: msg
      });
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [addAddress, form, resetFormAfterSave, saving, setCheckoutDraftAddress, showToast, user?.uid]);

  /** Hard fail-safe: never leave the save button stuck if Firestore hangs past our race timeout. */
  useEffect(() => {
    if (!saving) return;
    const safetyTimer = window.setTimeout(() => {
      saveInFlightRef.current = false;
      setSaving(false);
      showToast({
        title: "Something went wrong",
        description: "Try saving again.",
        type: "error"
      });
    }, 8000);
    return () => clearTimeout(safetyTimer);
  }, [saving, showToast]);

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
                    {savedAddresses.length > 0 ? (
                      <>
                        <span className="font-medium text-slate-700 dark:text-slate-200">Suggestions</span>
                        {" · "}
                        {locStatus === "ok" && userLoc && savedAddresses.some((a) => typeof a.lat === "number" && typeof a.lng === "number") ? (
                          <span className="inline-flex items-center gap-1">
                            <Navigation className="h-3 w-3 shrink-0" aria-hidden />
                            Sorted by nearest
                          </span>
                        ) : locStatus === "loading" ? (
                          "Locating you…"
                        ) : (
                          <span>Sorted by most recent</span>
                        )}
                      </>
                    ) : (
                      "Addresses are saved to your account and used at checkout."
                    )}
                  </p>

                  {!isSelectedAddressSynced && (checkoutDraftAddress || selectedId?.startsWith("temp-")) ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                      Not saved to account (temporary). You can still check out — we will sync when possible.
                    </p>
                  ) : null}

                  {checkoutDraftAddress && !savedAddresses.some((a) => a.id === checkoutDraftAddress.id) ? (
                    <ul className="space-y-2" role="radiogroup" aria-label="Address for this order">
                      <li>
                        <label
                          className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${
                            selectedId === checkoutDraftAddress.id
                              ? "border-orange-400 bg-orange-50/80 dark:border-orange-700 dark:bg-orange-950/30"
                              : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                          }`}
                        >
                          <input
                            type="radio"
                            name="delivery-address"
                            checked={selectedId === checkoutDraftAddress.id}
                            onChange={() => selectAddress(checkoutDraftAddress.id)}
                            className="mt-1"
                          />
                          <div className="min-w-0 text-sm">
                            <p className="font-semibold text-slate-900 dark:text-slate-50">{checkoutDraftAddress.name}</p>
                            <p className="text-slate-600 dark:text-slate-300">{checkoutDraftAddress.phone}</p>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
                              Not saved to account · {checkoutDraftAddress.label}
                            </p>
                            <p className="mt-1 text-slate-600 dark:text-slate-400">
                              {checkoutDraftAddress.addressLine}
                              {checkoutDraftAddress.landmark ? ` · ${checkoutDraftAddress.landmark}` : ""}
                              {checkoutDraftAddress.city ? ` · ${checkoutDraftAddress.city}` : ""}
                              {checkoutDraftAddress.pincode ? ` · ${checkoutDraftAddress.pincode}` : ""}
                            </p>
                          </div>
                        </label>
                      </li>
                    </ul>
                  ) : null}

                  {savedAddresses.length > 0 ? (
                    <ul className="space-y-2" role="radiogroup" aria-label="Saved addresses">
                      {suggestedAddresses.map((a) => {
                        const checked = selectedId === a.id;
                        const isLastUsed = lastUsedAddressId === a.id;
                        const labelClass =
                          a.label === "Home"
                            ? "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
                            : a.label === "Work"
                              ? "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100"
                              : "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100";
                        const distKm =
                          userLoc && typeof a.lat === "number" && typeof a.lng === "number"
                            ? getDistanceKm(userLoc, { lat: a.lat, lng: a.lng })
                            : null;
                        return (
                          <li key={a.id}>
                            <label
                              className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${
                                checked
                                  ? "border-orange-400 bg-orange-50/80 dark:border-orange-700 dark:bg-orange-950/30"
                                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                              } ${isLastUsed && !checked ? "ring-2 ring-amber-400/90 ring-offset-2 dark:ring-offset-slate-900" : ""}`}
                            >
                              <input
                                type="radio"
                                name="delivery-address"
                                checked={checked}
                                onChange={() => selectAddress(a.id)}
                                className="mt-1"
                              />
                              <div className="min-w-0 flex-1 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${labelClass}`}>
                                    {a.label}
                                  </span>
                                  {isLastUsed ? (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                                      Last used
                                    </span>
                                  ) : null}
                                  {distKm != null ? (
                                    <span className="ml-auto text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                                      {formatDistanceKm(distKm)}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-50">{a.name}</p>
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
                      {isGoogleMapsConfigured() ? (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                            Find on map
                          </label>
                          <CheckoutAddressPlacesSearch
                            disabled={saving}
                            onApply={(patch) =>
                              setForm((f) => ({
                                ...f,
                                ...patch
                              }))
                            }
                          />
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Pick a suggestion to fill street, city, PIN, and map location. You can edit below.
                          </p>
                        </div>
                      ) : null}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Label</label>
                        <select
                          value={form.label ?? "Home"}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, label: e.target.value as SavedAddressLabel }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                        >
                          <option value="Home">Home</option>
                          <option value="Work">Work</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
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
                      {formMessage ? <p className="text-xs text-amber-700 dark:text-amber-300">{formMessage}</p> : null}
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
                          aria-busy={saving}
                          onClick={() => void handleSaveAddress()}
                          className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white shadow-sm transition-opacity disabled:pointer-events-none disabled:opacity-60"
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
                {selectedId && !showForm && (savedAddresses.some((a) => a.id === selectedId) || checkoutDraftAddress?.id === selectedId) ? (
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
