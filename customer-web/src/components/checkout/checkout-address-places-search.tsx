"use client";

import { Autocomplete } from "@react-google-maps/api";
import { MapPin } from "lucide-react";
import { useCallback, useRef } from "react";
import type { DeliveryAddressInput } from "@/lib/delivery-address-types";
import { parsePlaceToFormPatch } from "@/lib/google-places-parsing";
import { useToast } from "@/components/providers/toast-provider";
import { useGoogleMapsReady } from "@/components/providers/google-maps-script";

type PlacesAutocompleteLike = {
  getPlace: () => Parameters<typeof parsePlaceToFormPatch>[0];
};

type Props = {
  disabled?: boolean;
  onApply: (patch: Partial<DeliveryAddressInput> & { lat?: number; lng?: number }) => void;
};

export function CheckoutAddressPlacesSearch({ disabled, onApply }: Props) {
  const acRef = useRef<PlacesAutocompleteLike | null>(null);
  const { showToast } = useToast();
  const { hasApiKey, isLoaded, loadError } = useGoogleMapsReady();

  const onPlaceChanged = useCallback(() => {
    const ac = acRef.current;
    if (!ac) return;
    const place = ac.getPlace();
    const patch = parsePlaceToFormPatch(place);
    if (!patch) {
      showToast({
        type: "error",
        title: "Could not read this place",
        description: "Try another result or enter the address manually."
      });
      return;
    }
    const out: Partial<DeliveryAddressInput> & { lat?: number; lng?: number } = {
      addressLine: patch.addressLine,
      city: patch.city,
      pincode: patch.pincode
    };
    if (
      typeof patch.lat === "number" &&
      typeof patch.lng === "number" &&
      Number.isFinite(patch.lat) &&
      Number.isFinite(patch.lng)
    ) {
      out.lat = patch.lat;
      out.lng = patch.lng;
    }
    onApply(out);
    showToast({ title: "Address filled from map", description: "Review and edit if needed, then save." });
  }, [onApply, showToast]);

  const inputClassName =
    "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  if (!hasApiKey || loadError) {
    return (
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="text"
          placeholder={loadError ? "Enter address manually (Maps unavailable)" : "Enter street, area, city (Maps key not set)"}
          disabled={disabled}
          autoComplete="street-address"
          className={inputClassName}
        />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="text"
          placeholder="Loading address search…"
          disabled
          autoComplete="off"
          className={inputClassName}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <Autocomplete
        onLoad={(ac) => {
          acRef.current = ac as PlacesAutocompleteLike;
        }}
        onPlaceChanged={onPlaceChanged}
        options={{
          componentRestrictions: { country: "in" },
          fields: ["address_components", "formatted_address", "geometry", "name"]
        }}
      >
        <input
          type="text"
          placeholder="Search your address on Google Maps…"
          disabled={disabled}
          autoComplete="off"
          className={inputClassName}
        />
      </Autocomplete>
    </div>
  );
}
