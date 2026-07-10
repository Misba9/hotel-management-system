import { useEffect, useState } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Button } from "@/src/components/ui/button";
import { auth } from "@/src/lib/firebase";
import { mapFirebaseAuthError } from "@/src/lib/firebase-auth-errors";
import {
  getAuthBridgeBaseUrl,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID
} from "@/src/lib/google-oauth-config";

WebBrowser.maybeCompleteAuthSession();

type Props = {
  onSuccess?: () => void;
  onAuthBusyChange?: (busy: boolean) => void;
};

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function extractParam(url: string, key: string): string | null {
  const match = url.match(new RegExp(`[?&#]${key}=([^&#]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function signInWithNativeGoogle(): Promise<boolean> {
  if (isExpoGo() || Platform.OS === "web") return false;
  try {
    const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false
    });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== "success") return false;
    const idToken = response.data.idToken;
    if (!idToken) throw new Error("Google Sign-In did not return an ID token.");
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  } catch (e) {
    if (/native module|RNGoogleSignin|cannot find|not found|ExpoGo/i.test(String(e))) {
      return false;
    }
    throw e;
  }
}

/** HTTPS page on production (never LAN/localhost). Deep-links back with Google id_token. */
async function signInWithHttpsGoogleBridge(): Promise<void> {
  const redirectUri = Linking.createURL("oauth");
  const bridgeUrl =
    `${getAuthBridgeBaseUrl()}/mobile-google-auth.html` +
    `?redirect=${encodeURIComponent(redirectUri)}`;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[GoogleAuth] HTTPS bridge", bridgeUrl, "→", redirectUri);
  }

  const result = await WebBrowser.openAuthSessionAsync(bridgeUrl, redirectUri);
  if (result.type !== "success" || !("url" in result) || !result.url) {
    if (result.type === "cancel" || result.type === "dismiss") {
      const err = new Error("Sign-in was cancelled.") as Error & { code?: string };
      err.code = "auth/cancelled-popup-request";
      throw err;
    }
    throw new Error("Google sign-in did not complete.");
  }
  const idToken = extractParam(result.url, "id_token");
  if (!idToken) {
    throw new Error(
      "Auth page did not return a token. Deploy public/mobile-google-auth.html to your HTTPS site."
    );
  }
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

/**
 * Google → Firebase Auth (no local customer-web).
 * Order: native Google Sign-In → AuthSession id_token → HTTPS bridge.
 */
export function GoogleSignInPanel({ onSuccess, onAuthBusyChange }: Props) {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    selectAccount: true
  });

  useEffect(() => {
    onAuthBusyChange?.(loading);
  }, [loading, onAuthBusyChange]);

  async function signIn() {
    setError(null);
    setLoading(true);
    try {
      if (await signInWithNativeGoogle()) {
        onSuccess?.();
        return;
      }

      if (request) {
        const result = await promptAsync();
        if (result.type === "cancel" || result.type === "dismiss") return;
        if (result.type === "success") {
          const idToken = result.params.id_token || result.authentication?.idToken || "";
          if (idToken) {
            await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
            onSuccess?.();
            return;
          }
        }
      }

      await signInWithHttpsGoogleBridge();
      onSuccess?.();
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "auth/cancelled-popup-request" || /cancel/i.test(String(e))) {
        return;
      }
      setError(mapFirebaseAuthError(e, "Could not sign in with Google."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.copy, { color: colors.textSecondary }]}>
        One tap with your Google account — quick and secure.
      </Text>
      {error ? (
        <Text style={[styles.errorBox, { backgroundColor: colors.dangerMuted, color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
      <Button
        title={loading ? "Signing in…" : "Continue with Google"}
        variant="secondary"
        onPress={() => void signIn()}
        loading={loading}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 12 },
  copy: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  errorBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    overflow: "hidden",
    textAlign: "center"
  }
});
