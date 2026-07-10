"use client";

import { Suspense } from "react";
import MobileAuthBridgeInner from "./bridge-inner";

export default function MobileAuthBridgePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
          <p className="text-sm text-slate-600">Loading sign-in…</p>
        </main>
      }
    >
      <MobileAuthBridgeInner />
    </Suspense>
  );
}
