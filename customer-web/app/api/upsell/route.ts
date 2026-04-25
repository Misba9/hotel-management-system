import { NextResponse } from "next/server";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp, getApps } from "firebase/app";
import { adminDb } from "@shared/firebase/admin";

const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  });

export async function POST(request: Request) {
  const body = (await request.json()) as { itemIds?: string[] };
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter((id) => typeof id === "string" && id.trim()) : [];
  if (itemIds.length === 0) {
    return NextResponse.json({ itemIds: [] }, { status: 200 });
  }

  try {
    const fn = httpsCallable(getFunctions(app), "getUpsellSuggestions");
    const result = await fn({ itemIds });
    return NextResponse.json(result.data, { status: 200 });
  } catch {
    // Fallback: return a few popular products from catalog if cloud function is unavailable.
    const snap = await adminDb.collection("products").limit(24).get();
    const ids = snap.docs
      .filter((doc) => {
        const data = doc.data() as { isAvailable?: boolean; available?: boolean };
        return data.isAvailable !== false && data.available !== false;
      })
      .map((doc) => doc.id)
      .filter((id) => !itemIds.includes(id))
      .slice(0, 3);
    return NextResponse.json({ itemIds: ids }, { status: 200 });
  }
}
