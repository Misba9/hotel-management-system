"use client";

import { useEffect } from "react";
import { initFirebaseAnalytics } from "@/lib/firebase";

/**
 * Registers Firebase Analytics when `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is set.
 */
export function FirebaseAnalytics() {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);
  return null;
}
