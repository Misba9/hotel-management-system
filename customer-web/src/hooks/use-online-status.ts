"use client";

import { useEffect, useState } from "react";

/**
 * Tracks `navigator.onLine` with `online` / `offline` window events.
 * Note: "online" only means the browser thinks there is a route — not guaranteed Firestore reachability.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
