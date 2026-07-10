import Constants from "expo-constants";

declare const process: { env: Record<string, string | undefined> };

/** Web OAuth client from google-services.json (client_type: 3) — used with Firebase. */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
  "611343650554-gnmmga6dtvmf4qh1f50unsjc6r0jkota.apps.googleusercontent.com";

/** Android OAuth client (client_type: 1) from google-services.json. */
export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ||
  "611343650554-6sl7a5n0t9i91jdif734qo4p9l59pl0f.apps.googleusercontent.com";

export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || GOOGLE_WEB_CLIENT_ID;

/**
 * Public HTTPS origin for the OAuth bridge (Apple on Android / Expo Go fallback).
 * Never use LAN/localhost for Google/Apple — those die when customer-web isn't running.
 */
export function getAuthBridgeBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_AUTH_BRIDGE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (typeof extra?.authBridgeUrl === "string" && extra.authBridgeUrl.trim()) {
    return extra.authBridgeUrl.trim().replace(/\/$/, "");
  }

  return "https://www.nausheenfruitjuicecenter.com";
}
