"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MAP_CONTAINER_STYLE = { width: "100%", height: "min(42vh, 320px)" };

function useSmoothRiderPosition(target: { lat: number; lng: number } | null) {
  const [display, setDisplay] = useState<{ lat: number; lng: number } | null>(target);
  const displayRef = useRef<{ lat: number; lng: number } | null>(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    if (!target) {
      displayRef.current = null;
      setDisplay(null);
      return;
    }

    const from = displayRef.current;
    if (!from) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    if (from.lat === target.lat && from.lng === target.lng) return;

    const start = performance.now();
    const duration = 720;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = 1 - (1 - t) ** 2;
      const next = {
        lat: from.lat + (target.lat - from.lat) * k,
        lng: from.lng + (target.lng - from.lng) * k
      };
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = target;
        setDisplay(target);
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target?.lat, target?.lng]);

  return display;
}

export type DeliveryMapProps = {
  /** Rider live position (from `orders.riderLocation` or legacy `lat`/`lng`). */
  rider?: { lat: number; lng: number } | null;
  /** @deprecated Prefer `rider` — kept for backward compatibility. */
  lat?: number;
  /** @deprecated Prefer `rider` — kept for backward compatibility. */
  lng?: number;
  restaurant?: { lat: number; lng: number } | null;
  delivery?: { lat: number; lng: number } | null;
  etaMinutes?: number | null;
  arrivingLabel?: string | null;
  agentMarkerTitle?: string;
};

/**
 * Google Map: restaurant, delivery drop, and rider markers; rider path animates between GPS updates.
 */
export function DeliveryLiveMap({
  lat,
  lng,
  rider,
  restaurant,
  delivery,
  etaMinutes,
  arrivingLabel,
  agentMarkerTitle
}: DeliveryMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: "delivery-live-map-script"
  });

  const riderTarget =
    rider ??
    (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null);

  const riderAnimated = useSmoothRiderPosition(riderTarget);

  const mapRef = useRef<google.maps.Map | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const iconUrls = useMemo(
    () => ({
      restaurant: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
      delivery: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      rider: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png"
    }),
    []
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps?.LatLngBounds) return;

    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    if (restaurant) {
      bounds.extend(restaurant);
      count += 1;
    }
    if (delivery) {
      bounds.extend(delivery);
      count += 1;
    }
    if (riderAnimated) {
      bounds.extend(riderAnimated);
      count += 1;
    }

    if (count === 0) return;
    if (count === 1) {
      const c = riderAnimated ?? delivery ?? restaurant;
      if (c) {
        map.setCenter(c);
        map.setZoom(15);
      }
      return;
    }
    map.fitBounds(bounds, 56);
  }, [restaurant, delivery, riderAnimated, isLoaded]);

  const defaultArrival =
    typeof etaMinutes === "number" && Number.isFinite(etaMinutes) && etaMinutes > 0
      ? `Arriving in ~${Math.round(etaMinutes)} min`
      : null;
  const arrival = arrivingLabel ?? defaultArrival;

  const sampleCoord =
    riderTarget?.lat ??
    delivery?.lat ??
    restaurant?.lat ??
    (typeof lat === "number" ? lat : 0);

  if (!apiKey.trim()) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
        <p>
          Add{" "}
          <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-800">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          to show the live map.
        </p>
        <p className="mt-2 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-500">
          {Number(sampleCoord).toFixed(5)}
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

  if (!riderAnimated && !restaurant && !delivery) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        No map points available yet.
      </div>
    );
  }

  const center = riderAnimated ?? delivery ?? restaurant ?? { lat: 0, lng: 0 };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-md dark:border-slate-700">
      {arrival ? (
        <p className="border-b border-slate-100 bg-emerald-50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-900 dark:border-slate-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          {arrival}
        </p>
      ) : null}
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={15}
        onLoad={onMapLoad}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        }}
      >
        {restaurant ? (
          <Marker position={restaurant} icon={iconUrls.restaurant} title="Restaurant" zIndex={1} />
        ) : null}
        {delivery ? (
          <Marker position={delivery} icon={iconUrls.delivery} title="Your address" zIndex={2} />
        ) : null}
        {riderAnimated ? (
          <Marker
            position={riderAnimated}
            icon={iconUrls.rider}
            title={agentMarkerTitle ?? "Delivery partner"}
            zIndex={3}
          />
        ) : null}
      </GoogleMap>
      <div className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
        {restaurant ? (
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-600" aria-hidden /> Restaurant
          </span>
        ) : null}
        {delivery ? (
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" aria-hidden /> Delivery
          </span>
        ) : null}
        {riderTarget ? (
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-500" aria-hidden /> Rider (live)
          </span>
        ) : null}
      </div>
    </div>
  );
}
