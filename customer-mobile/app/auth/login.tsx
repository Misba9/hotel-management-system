import { signInWithCustomToken } from "firebase/auth";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { auth } from "@/src/lib/firebase";
import { apiFetch } from "@/src/lib/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export default function LoginScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, mode: "signin" })
      });
      const data = (await res.json()) as { customToken?: string; error?: string };
      if (!res.ok || !data.customToken) {
        setError(data.error || "Login failed. Check your credentials.");
        return;
      }
      await signInWithCustomToken(auth, data.customToken);
      router.replace("/(tabs)/home");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.wrap, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { color: colors.textPrimary }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>Sign in to order fresh fruits</Text>

        <View style={styles.form}>
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <Button title="Sign in" onPress={handleLogin} loading={loading} />
        </View>

        <Link href="/auth/forgot-password" style={[styles.link, { color: colors.primary }]}>
          Forgot password?
        </Link>
        <View style={styles.footer}>
          <Text style={{ color: colors.textSecondary }}>Don't have an account? </Text>
          <Link href="/auth/signup" style={{ color: colors.primary, fontWeight: "700" }}>
            Sign up
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 80, justifyContent: "center" },
  heading: { fontSize: 28, fontWeight: "900" },
  sub: { fontSize: 15, marginTop: 8, marginBottom: 32 },
  form: { gap: 4 },
  error: { fontSize: 13, marginBottom: 12 },
  link: { textAlign: "center", marginTop: 16, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 }
});
