"use client";

import { Check, Home, MapPin, MapPinned, MoreHorizontal, Pencil, Trash2, Briefcase } from "lucide-react";
import type { DeliveryAddress } from "@/lib/delivery-address-types";

type AddressCardProps = {
  address: DeliveryAddress;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  disabled?: boolean;
};

export function AddressCard({
  address,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  disabled
}: AddressCardProps) {
  const labelIcon =
    address.label === "Work" ? (
      <Briefcase className="h-3.5 w-3.5" aria-hidden />
    ) : address.label === "Other" ? (
      <MapPinned className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <Home className="h-3.5 w-3.5" aria-hidden />
    );

  const fullLine = [
    address.addressLine,
    address.landmark ? `Near ${address.landmark}` : null,
    [address.city, address.pincode].filter(Boolean).join(" — ")
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`relative rounded-2xl border p-4 text-left transition-all duration-200 ${
        selected
          ? "border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30 dark:bg-orange-950/40"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
      } ${disabled ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            selected ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {labelIcon}
              {address.label}
            </span>
            {address.isDefault ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Default
              </span>
            ) : null}
            {selected ? (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Selected
              </span>
            ) : null}
          </div>
          <p className="mt-2 font-semibold text-slate-900 dark:text-slate-50">{address.name}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{address.phone}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{fullLine}</p>
        </div>

        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <details className="group relative">
            <summary
              className="flex cursor-pointer list-none items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden"
              aria-label="Address actions"
            >
              <MoreHorizontal className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
              {!address.isDefault ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    onSetDefault();
                    (document.activeElement as HTMLElement | null)?.blur();
                  }}
                >
                  <Check className="h-4 w-4" />
                  Set as default
                </button>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => {
                  onEdit();
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => {
                  onDelete();
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
