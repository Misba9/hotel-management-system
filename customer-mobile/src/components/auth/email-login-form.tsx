import { useCallback, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from "firebase/auth";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { auth } from "@/src/lib/firebase";
import { mapFirebaseAuthError } from "@/src/lib/firebase-auth-errors";

const MIN_PASSWORD_LEN = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

type Mode = "signin" | "signup";

type Props = {
  onSuccess?: () => void;
  onAuthBusyChange?: (busy: boolean) => void;
  initialMode?: Mode;
};

type FieldErrors = {
  email?: string;
  password?: string;
  confirm?: string;
};

function validateFields(email: string, password: string, confirm: string, mode: Mode): FieldErrors {
  const errors: FieldErrors = {};
  const e = email.trim();
  if (!e) errors.email = "Enter your email address.";
  else if (!EMAIL_REGEX.test(e)) errors.email = "Use a valid email format (e.g. name@example.com).";
  if (!password) errors.password = "Enter your password.";
  else if (password.length < MIN_PASSWORD_LEN) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LEN} characters.`;
  }
  if (mode === "signup" && password !== confirm) {
    errors.confirm = "Passwords must match.";
  }
  return errors;
}

export function EmailLoginForm({ onSuccess, onAuthBusyChange, initialMode = "signin" }: Props) {
  const colors = useThemeColors();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    onAuthBusyChange?.(loading);
  }, [loading, onAuthBusyChange]);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setFieldErrors({});
    setAuthError(null);
    if (next === "signin") setConfirm("");
  }, []);

  async function submit() {
    const clientErrors = validateFields(email, password, confirm, mode);
    setFieldErrors(clientErrors);
    setAuthError(null);
    if (Object.keys(clientErrors).length > 0) return;

    setLoading(true);
    try {
      const trimmed = email.trim();
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, trimmed, password);
      } else {
        await signInWithEmailAndPassword(auth, trimmed, password);
      }
      onSuccess?.();
    } catch (e) {
      setAuthError(mapFirebaseAuthError(e, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.modeTabs, { backgroundColor: colors.hover, borderColor: colors.border }]}>
        <Pressable
          onPress={() => switchMode("signin")}
          style={[styles.modeTab, mode === "signin" ? { backgroundColor: colors.surface } : null]}
        >
          <Text
            style={[
              styles.modeText,
              { color: mode === "signin" ? colors.primary : colors.textSecondary }
            ]}
          >
            Login
          </Text>
        </Pressable>
        <Pressable
          onPress={() => switchMode("signup")}
          style={[styles.modeTab, mode === "signup" ? { backgroundColor: colors.surface } : null]}
        >
          <Text
            style={[
              styles.modeText,
              { color: mode === "signup" ? colors.primary : colors.textSecondary }
            ]}
          >
            Sign up
          </Text>
        </Pressable>
      </View>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === "signup" ? "new-password" : "password"}
        error={fieldErrors.password}
      />
      {mode === "signup" ? (
        <Input
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />
      ) : null}

      {authError ? (
        <Text style={[styles.errorBox, { backgroundColor: colors.dangerMuted, color: colors.danger }]}>
          {authError}
        </Text>
      ) : null}

      <Button
        title={
          loading
            ? mode === "signup"
              ? "Creating account…"
              : "Signing in…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"
        }
        onPress={() => void submit()}
        loading={loading}
        disabled={!email.trim() || !password || (mode === "signup" && !confirm)}
      />
      {mode === "signin" ? (
        <Link href="/auth/forgot-password" style={[styles.forgot, { color: colors.primary }]}>
          Forgot password?
        </Link>
      ) : null}
    </View>
  );
}

/** Used by forgot-password screen — kept here for a single email-auth module surface. */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  modeTabs: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  modeText: { fontSize: 14, fontWeight: "700" },
  errorBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 12,
    overflow: "hidden"
  },
  forgot: { textAlign: "center", marginTop: 16, fontWeight: "600", fontSize: 14 }
});
