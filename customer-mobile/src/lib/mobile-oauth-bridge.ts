import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { signInWithCustomToken } from "firebase/auth";
import { Platform } from "react-native";
import { getAuthBridgeBaseUrl } from "@/src/lib/google-oauth-config";
import { auth } from "@/src/lib/firebase";

WebBrowser.maybeCompleteAuthSession();

export type MobileOAuthProvider = "google" | "apple";

function extractParam(url: string, key: string): string | null {
  const match = url.match(new RegExp(`[?&#]${key}=([^&#]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Opens the public HTTPS OAuth bridge (production by default), then signs into Firebase
 * with the returned custom token. Used for Apple when native Sign in with Apple isn't available.
 * Does not use LAN/localhost API base — that caused connection refused on device.
 */
export async function signInWithMobileOAuthBridge(provider: MobileOAuthProvider): Promise<void> {
  const redirectUri = Linking.createURL("oauth");
  const base = getAuthBridgeBaseUrl();
  const bridgeUrl =
    `${base}/auth/mobile-bridge` +
    `?provider=${encodeURIComponent(provider)}` +
    `&redirect=${encodeURIComponent(redirectUri)}`;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[OAuthBridge]", { provider, bridgeUrl, redirectUri, platform: Platform.OS });
  }

  const result = await WebBrowser.openAuthSessionAsync(bridgeUrl, redirectUri);

  if (result.type !== "success" || !("url" in result) || !result.url) {
    if (result.type === "cancel" || result.type === "dismiss") {
      const err = new Error("Sign-in was cancelled.") as Error & { code?: string };
      err.code = "auth/cancelled-popup-request";
      throw err;
    }
    throw new Error("Sign-in did not complete. Try again.");
  }

  const customToken = extractParam(result.url, "customToken");
  if (!customToken) {
    throw new Error(
      "Sign-in bridge did not return a token. Deploy customer-web (with /auth/mobile-bridge) or set EXPO_PUBLIC_AUTH_BRIDGE_URL."
    );
  }

  await signInWithCustomToken(auth, customToken);
}
