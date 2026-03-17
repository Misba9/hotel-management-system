import { NextResponse } from "next/server";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp, getApps } from "firebase/app";

const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  });

export async function POST(request: Request) {
  const body = (await request.json()) as { itemIds: string[] };
  const fn = httpsCallable(getFunctions(app), "getUpsellSuggestions");
  const result = await fn(body);
  return NextResponse.json(result.data);
}
