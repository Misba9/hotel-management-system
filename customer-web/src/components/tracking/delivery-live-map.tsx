"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

export type DeliveryMapProps = {
  lat: number;
  lng: number;
  etaMinutes?: number | null;
  /** Overrides the default “Arriving in …” line. */
  arrivingLabel?: string | null;
  /** Accessible label for the rider marker (delivery agent). */
  agentMarkerTitle?: string;
};

/**
 * Google Map centered on the rider with a marker (DROP animation on position updates via key).
 */
export function DeliveryLiveMap({ lat, lng, etaMinutes, arrivingLabel, agentMarkerTitle }: DeliveryMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: "delivery-live-map-script"
  });

  if (!apiKey.trim()) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
        <p>
          Add{" "}
          <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-800">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          to show the live map.
        </p>
        <p className="mt-2 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-500">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        Could not load Google Maps. Check the API key and billing.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="h-[min(42vh,320px)] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
        aria-busy
        aria-label="Loading map"
      />
    );
  }

  const center = { lat, lng };
  const defaultArrival =
    typeof etaMinutes === "number" && Number.isFinite(etaMinutes) && etaMinutes > 0
      ? `Arriving in ~${Math.round(etaMinutes)} min`
      : null;
  const arrival = arrivingLabel ?? defaultArrival;

  const drop =
    typeof window !== "undefined" && window.google?.maps?.Animation
      ? window.google.maps.Animation.DROP
      : undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-md dark:border-slate-700">
      {arrival ? (
        <p className="border-b border-slate-100 bg-emerald-50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-900 dark:border-slate-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          {arrival}
        </p>
      ) : null}
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "min(42vh, 320px)" }}
        center={center}
        zoom={15}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        }}
      >
        <Marker
          key={`${lat.toFixed(6)}-${lng.toFixed(6)}`}
          position={center}
          animation={drop}
          title={agentMarkerTitle ?? "Delivery partner"}
        />
      </GoogleMap>
    </div>
  );
}
