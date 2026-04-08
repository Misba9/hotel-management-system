import { NextResponse } from "next/server";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp, getApps } from "firebase/app";
import { requireAdmin } from "@shared/utils/admin-api-auth";

const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  });

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_analytics_get", limit: 60, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  const fn = httpsCallable(getFunctions(app), "getAdminAnalytics");
  const result = await fn({
    dayKey: new Date().toISOString().slice(0, 10)
  });
  return NextResponse.json(result.data);
}
