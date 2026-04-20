"use client";

import { FirebaseError } from "firebase/app";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useDeliveryAddress } from "@/context/delivery-address-context";
import { useToast } from "@/components/providers/toast-provider";
import { CheckoutAddressPlacesSearch } from "@/components/checkout/checkout-address-places-search";
import { isGoogleMapsConfigured } from "@/components/providers/google-maps-script";
import { validateNewAddress } from "@/lib/address-form-validation";
import type { DeliveryAddress, DeliveryAddressInput, SavedAddressLabel } from "@/lib/delivery-address-types";
import { promiseWithTimeout } from "@/lib/promise-with-timeout";

const SAVE_FIRESTORE_TIMEOUT_MS = 45_000;

/** Empty form — reset after save / close so the next open is a clean slate. */
const INITIAL_ADDRESS_FORM: DeliveryAddressInput = {
  label: "Home",
  name: "",
  phone: "",
  addressLine: "",
  landmark: "",
  city: "",
  pincode: ""
};

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

type AddAddressDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, drawer opens in edit mode with this row. */
  editing: DeliveryAddress | null;
  onSaved?: () => void;
};

export function AddAddressDrawer({ open, onOpenChange, editing, onSaved }: AddAddressDrawerProps) {
  const { user } = useAuth();
  const { addAddress, updateAddress, setCheckoutDraftAddress, refreshAddresses } = useDeliveryAddress();
  const { showToast } = useToast();
  const saveInFlightRef = useRef(false);
  /** Tracks that the sheet was open so we only refresh after a real close, not on first mount. */
  const hadOpenRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DeliveryAddressInput>(() => ({ ...INITIAL_ADDRESS_FORM }));
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof DeliveryAddressInput, string>>>({});

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_ADDRESS_FORM });
    setFormErrors({});
  }, []);

  /**
   * When the popup closes (`open` → false): reset form, stop saving, clear in-flight — fully automatic.
   * Optional list refresh shortly after close (best-effort; onSnapshot usually already updated).
   */
  useEffect(() => {
    if (open) {
      hadOpenRef.current = true;
      return;
    }

    const wasOpenedBefore = hadOpenRef.current;
    hadOpenRef.current = false;

    setSaving(false);
    saveInFlightRef.current = false;
    resetForm();

    if (!wasOpenedBefore) return;

    const t = window.setTimeout(() => {
      void refreshAddresses().catch(() => {});
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, refreshAddresses, resetForm]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("saving:", saving, "open:", open);
    }
  }, [saving, open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        ...INITIAL_ADDRESS_FORM,
        label: editing.label,
        name: editing.name,
        phone: editing.phone,
        addressLine: editing.addressLine,
        landmark: editing.landmark,
        city: editing.city,
        pincode: editing.pincode,
        ...(typeof editing.lat === "number" ? { lat: editing.lat } : {}),
        ...(typeof editing.lng === "number" ? { lng: editing.lng } : {})
      });
    } else {
      setForm({ ...INITIAL_ADDRESS_FORM });
    }
    setFormErrors({});
  }, [open, editing]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSave = useCallback(async () => {
    if (!user?.uid) {
      window.alert("Please sign in to save an address.");
      return;
    }

    setFormErrors({});
    const err = validateNewAddress(form);
    setFormErrors(err);
    if (Object.keys(err).length > 0) return;

    if (saveInFlightRef.current) return;

    saveInFlightRef.current = true;
    setSaving(true);
    console.log("Saving started");
    console.log("User ID:", user.uid);

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setCheckoutDraftAddress(formToTempDelivery(user.uid, form));
        console.log("Address saved (offline draft)");
        handleClose();
        onSaved?.();
        showToast({
          title: "You are offline",
          description: "We will use this address for checkout and sync when you are online.",
          type: "warning"
        });
        return;
      }

      if (editing) {
        await promiseWithTimeout(
          updateAddress(editing.id, form),
          SAVE_FIRESTORE_TIMEOUT_MS,
          "Save timed out. Check your internet connection and try again."
        );
        console.log("Address saved (update)", editing.id);
      } else {
        const saved = await promiseWithTimeout(
          addAddress(form),
          SAVE_FIRESTORE_TIMEOUT_MS,
          "Save timed out. Check your internet connection and try again."
        );
        console.log("Address saved", saved?.id);
      }

      console.log("Address saved");
      handleClose();
      onSaved?.();
      showToast({
        title: "Address saved",
        description: "Your delivery address is stored on your account.",
        type: "success"
      });
    } catch (error) {
      console.error("Save error:", error);
      const offlineMsg =
        error instanceof FirebaseError &&
        (error.code === "unavailable" || /offline|client is offline/i.test(error.message));
      const msg =
        error instanceof FirebaseError
          ? error.code === "permission-denied"
            ? "Permission denied. Sign out and sign in again."
            : offlineMsg
              ? "Firestore could not reach the server. Check your connection or try again in a moment."
              : error.message
          : error instanceof Error
            ? error.message
            : "Could not save";
      showToast({ type: "error", title: "Failed to save address", description: msg });
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
      console.log("Saving finished");
    }
  }, [addAddress, editing, form, handleClose, onSaved, setCheckoutDraftAddress, showToast, updateAddress, user?.uid]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col justify-end sm:justify-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={handleClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-address-drawer-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="relative z-[1] max-h-[min(92dvh,720px)] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:mx-auto sm:max-w-lg sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <h2 id="add-address-drawer-title" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {editing ? "Edit address" : "Add new address"}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-4 pb-8 sm:p-5">
              {isGoogleMapsConfigured() ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Search on map
                  </label>
                  <CheckoutAddressPlacesSearch
                    key={open ? `${editing?.id ?? "new"}-places` : "closed"}
                    disabled={saving}
                    onApply={(patch) => setForm((f) => ({ ...f, ...patch }))}
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Pick a suggestion to auto-fill street, city, and PIN.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Label</label>
                <select
                  value={form.label ?? "Home"}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value as SavedAddressLabel }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {(
                [
                  ["name", "Full name", "text", "name"],
                  ["phone", "Phone", "tel", "tel"],
                  ["addressLine", "Street, area, flat", "text", "street-address"],
                  ["landmark", "Landmark (optional)", "text", "off"],
                  ["city", "City", "text", "address-level2"],
                  ["pincode", "PIN code", "text", "postal-code"]
                ] as const
              ).map(([key, label, type, auto]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>
                  <input
                    type={type}
                    inputMode={key === "phone" ? "tel" : key === "pincode" ? "numeric" : undefined}
                    autoComplete={auto}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900 sm:text-base"
                  />
                  {formErrors[key] ? <p className="mt-1 text-xs text-red-600">{formErrors[key]}</p> : null}
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold dark:border-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  aria-busy={saving}
                  onClick={() => void handleSave()}
                  className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? "Saving..." : editing ? "Save changes" : "Save & use"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
