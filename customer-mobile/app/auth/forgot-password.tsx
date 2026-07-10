import { useState } from "react";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { requestPasswordReset } from "@/src/components/auth/email-login-form";
import { mapFirebaseAuthError } from "@/src/lib/firebase-auth-errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export default function ForgotPasswordScreen() {
  const colors = useThemeColors();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    const trimmed = email.trim();
    setError(null);
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(trimmed);
      setSent(true);
    } catch (e) {
      setError(mapFirebaseAuthError(e, "Could not send reset email."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Forgot password" />
      <View style={styles.body}>
        {sent ? (
          <>
            <Text style={[styles.text, { color: colors.textPrimary }]}>
              If an account exists for {email.trim()}, a password reset link has been sent. Check your
              inbox and spam folder.
            </Text>
            <Link href="/auth/login" style={[styles.link, { color: colors.primary }]}>
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              Enter your account email and we’ll send a reset link.
            </Text>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {error ? (
              <Text
                style={[styles.errorBox, { backgroundColor: colors.dangerMuted, color: colors.danger }]}
              >
                {error}
              </Text>
            ) : null}
            <Button
              title={loading ? "Sending…" : "Send reset link"}
              onPress={() => void submit()}
              loading={loading}
              disabled={!email.trim()}
            />
            <Link href="/auth/login" style={[styles.link, { color: colors.primary }]}>
              Back to sign in
            </Link>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: 24, gap: 12 },
  text: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  link: { marginTop: 16, fontWeight: "700", fontSize: 15 },
  errorBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    overflow: "hidden"
  }
});
