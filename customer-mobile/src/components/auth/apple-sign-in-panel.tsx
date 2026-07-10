import { useEffect, useState } from "react";
import { OAuthProvider, signInWithCredential } from "firebase/auth";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Button } from "@/src/components/ui/button";
import { auth } from "@/src/lib/firebase";
import { mapFirebaseAuthError } from "@/src/lib/firebase-auth-errors";
import { signInWithMobileOAuthBridge } from "@/src/lib/mobile-oauth-bridge";

type Props = {
  onSuccess?: () => void;
  onAuthBusyChange?: (busy: boolean) => void;
};

/**
 * Apple sign-in: native on iOS when available; otherwise web OAuth bridge
 * (works in Expo Go / Android when Apple is enabled in Firebase).
 */
export function AppleSignInPanel({ onSuccess, onAuthBusyChange }: Props) {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState(false);

  useEffect(() => {
    onAuthBusyChange?.(loading);
  }, [loading, onAuthBusyChange]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (Platform.OS !== "ios") return;
      try {
        const AppleAuthentication = await import("expo-apple-authentication");
        const ok = await AppleAuthentication.isAvailableAsync();
        if (!cancelled) setNativeAvailable(ok);
      } catch {
        if (!cancelled) setNativeAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signInNative() {
    const AppleAuthentication = await import("expo-apple-authentication");
    const Crypto = await import("expo-crypto");
    const rawNonce = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 36).toString(36)
    ).join("");
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL
      ],
      nonce: hashedNonce
    });
    if (!credential.identityToken) {
      throw new Error("Apple Sign-In did not return an identity token.");
    }
    const provider = new OAuthProvider("apple.com");
    const firebaseCredential = provider.credential({
      idToken: credential.identityToken,
      rawNonce
    });
    await signInWithCredential(auth, firebaseCredential);
  }

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      if (Platform.OS === "ios" && nativeAvailable) {
        await signInNative();
      } else {
        await signInWithMobileOAuthBridge("apple");
      }
      onSuccess?.();
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (
        code === "ERR_REQUEST_CANCELED" ||
        code === "auth/cancelled-popup-request" ||
        /cancel/i.test(String(e))
      ) {
        return;
      }
      setError(mapFirebaseAuthError(e, "Could not sign in with Apple."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.copy, { color: colors.textSecondary }]}>
        Sign in with your Apple ID. Enable the Apple provider in Firebase Console → Authentication.
      </Text>
      {error ? (
        <Text style={[styles.errorBox, { backgroundColor: colors.dangerMuted, color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
      <Button
        title={loading ? "Signing in…" : "Continue with Apple"}
        onPress={() => void signIn()}
        loading={loading}
      />
      <Text style={[styles.note, { color: colors.textSecondary }]}>
        {Platform.OS === "ios" && nativeAvailable
          ? "Uses native Apple Sign-In on this device."
          : "Opens a secure browser window (production auth bridge)."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 12 },
  copy: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  note: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  errorBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    overflow: "hidden",
    textAlign: "center"
  }
});
