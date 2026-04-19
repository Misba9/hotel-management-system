"use client";

import { LoadScript } from "@react-google-maps/api";
import type { ReactNode } from "react";

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/**
 * Loads Google Maps JS + Places once for the customer app (Autocomplete, etc.).
 * If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is unset, children render without Maps (forms stay manual).
 */
export function GoogleMapsScriptProvider({ children }: { children: ReactNode }) {
  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={["places"]} loadingElement={<span className="sr-only" aria-hidden />}>
      {children}
    </LoadScript>
  );
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(apiKey);
}
