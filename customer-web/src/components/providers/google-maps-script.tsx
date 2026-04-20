"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import { createContext, useContext, type ReactNode } from "react";

export type GoogleMapsReadyValue = {
  hasApiKey: boolean;
  /** True when Maps JS API is ready (`window.google.maps` available). */
  isLoaded: boolean;
  loadError: Error | undefined;
};

const GoogleMapsContext = createContext<GoogleMapsReadyValue | null>(null);

/** When no provider (or SSR edge), behave like Maps unavailable: manual address only, no throw. */
const OUTSIDE_PROVIDER: GoogleMapsReadyValue = {
  hasApiKey: false,
  isLoaded: false,
  loadError: undefined
};

export function useGoogleMapsReady(): GoogleMapsReadyValue {
  const ctx = useContext(GoogleMapsContext);
  return ctx ?? OUTSIDE_PROVIDER;
}

/**
 * Loads Google Maps JS + Places once. Children must not mount `Autocomplete` / `GoogleMap`
 * until `isLoaded` is true (use `useGoogleMapsReady()`).
 */
export function GoogleMapsScriptProvider({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (!key) {
    return (
      <GoogleMapsContext.Provider value={{ hasApiKey: false, isLoaded: false, loadError: undefined }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }
  return <GoogleMapsLoaderInner apiKey={key}>{children}</GoogleMapsLoaderInner>;
}

function GoogleMapsLoaderInner({ apiKey, children }: { apiKey: string; children: ReactNode }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "customer-web-google-maps",
    googleMapsApiKey: apiKey,
    libraries: ["places"]
  });
  return (
    <GoogleMapsContext.Provider
      value={{
        hasApiKey: true,
        isLoaded,
        loadError: loadError ?? undefined
      }}
    >
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
}
