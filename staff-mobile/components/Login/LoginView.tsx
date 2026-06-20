import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "../../store/useAuthStore";
import { friendlyAuthMessage } from "./auth-messages";
import {
  loginButtonGradient,
  loginCardShadow,
  loginColors,
  loginFont,
  loginRadius
} from "./login-theme";
import { validateEmail, validateLoginForm, validatePassword, type FieldErrors } from "./login-validation";

const REMEMBER_EMAIL_KEY = "staff:remembered_email";
const RESTAURANT_NAME = "Nausheen Fruits Juice Center";
const BRANCH_NAME = "Main Branch";
const SAAS_NAME = "Fruit Hotel Platform";
const APP_VERSION = "v1.0";

const FEATURES = [
  { icon: "restaurant-outline" as const, label: "Live order queue & kitchen tracking" },
  { icon: "card-outline" as const, label: "Fast billing & multi-platform POS" },
  { icon: "shield-checkmark-outline" as const, label: "Role-based secure staff access" }
] as const;

const LoginBrandPanel = memo(function LoginBrandPanel({ wide }: { wide: boolean }) {
  if (!wide) return null;

  return (
    <View style={styles.brandPanel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.brandTop}>
        <View style={styles.logoMark}>
          <Text style={styles.logoEmoji} accessibilityLabel="Restaurant logo">
            🍊
          </Text>
        </View>
        <Text style={styles.brandRestaurant}>{RESTAURANT_NAME}</Text>
        <Text style={styles.brandBranch}>{BRANCH_NAME}</Text>
      </View>

      <View style={styles.illustrationWrap}>
        <View style={styles.illustrationOrb} />
        <View style={styles.illustrationCard}>
          <Ionicons name="sparkles" size={28} color={loginColors.primary} />
          <Text style={styles.illustrationTitle}>Restaurant operations, unified</Text>
          <Text style={styles.illustrationText}>
            Manage orders, billing, and floor service from one premium staff workspace.
          </Text>
        </View>
      </View>

      <View style={styles.featureList}>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={18} color={loginColors.primary} />
            </View>
            <Text style={styles.featureLabel}>{f.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

type LoginFormProps = {
  compact: boolean;
  onSubmit: () => void;
  busy: boolean;
  phase: "idle" | "signing_in" | "loading_profile";
  email: string;
  password: string;
  showPassword: boolean;
  rememberMe: boolean;
  fieldErrors: FieldErrors;
  formError: string | null;
  canRetry: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onTogglePassword: () => void;
  onRememberMeChange: (v: boolean) => void;
  onForgotPassword: () => void;
  onBlurEmail: () => void;
  onBlurPassword: () => void;
};

const LoginFormCard = memo(function LoginFormCard({
  compact,
  onSubmit,
  busy,
  phase,
  email,
  password,
  showPassword,
  rememberMe,
  fieldErrors,
  formError,
  canRetry,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onRememberMeChange,
  onForgotPassword,
  onBlurEmail,
  onBlurPassword
}: LoginFormProps) {
  const statusLabel =
    phase === "signing_in" ? "Signing in..." : phase === "loading_profile" ? "Loading profile..." : "Continue";

  return (
    <View style={[styles.card, loginCardShadow(), compact && styles.cardCompact]}>
      {!compact ? (
        <View style={styles.mobileBrand}>
          <Text style={styles.logoEmojiSmall}>🍊</Text>
          <View style={styles.mobileBrandText}>
            <Text style={styles.mobileRestaurant}>{RESTAURANT_NAME}</Text>
            <Text style={styles.mobileBranch}>{BRANCH_NAME}</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.kicker}>STAFF APP</Text>
      <Text style={styles.title} accessibilityRole="header">
        Welcome Back
      </Text>
      <Text style={styles.subtitle}>Sign in to continue to your restaurant dashboard.</Text>

      {formError ? (
        <View style={styles.formErrorBanner} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={loginColors.error} />
          <Text style={styles.formErrorText}>{formError}</Text>
          {canRetry ? (
            <Pressable
              onPress={onSubmit}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Retry sign in"
              hitSlop={8}
            >
              <Text style={styles.retryLink}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.label} nativeID="login-email-label">
        Email
      </Text>
      <View style={[styles.inputWrap, fieldErrors.email ? styles.inputWrapError : null]}>
        <Ionicons name="mail-outline" size={20} color={loginColors.textDim} style={styles.inputIcon} />
        <TextInput
          placeholder="Enter your email"
          placeholderTextColor={loginColors.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          accessibilityLabel="Email address"
          accessibilityLabelledBy="login-email-label"
          returnKeyType="next"
          value={email}
          onChangeText={onEmailChange}
          onBlur={onBlurEmail}
          editable={!busy}
          style={styles.input}
        />
      </View>
      {fieldErrors.email ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          ❌ {fieldErrors.email}
        </Text>
      ) : null}

      <Text style={styles.label} nativeID="login-password-label">
        Password
      </Text>
      <View style={[styles.inputWrap, fieldErrors.password ? styles.inputWrapError : null]}>
        <Ionicons name="lock-closed-outline" size={20} color={loginColors.textDim} style={styles.inputIcon} />
        <TextInput
          placeholder="Enter your password"
          placeholderTextColor={loginColors.textDim}
          secureTextEntry={!showPassword}
          autoComplete="password"
          textContentType="password"
          accessibilityLabel="Password"
          accessibilityLabelledBy="login-password-label"
          returnKeyType="go"
          onSubmitEditing={() => !busy && onSubmit()}
          value={password}
          onChangeText={onPasswordChange}
          onBlur={onBlurPassword}
          editable={!busy}
          style={styles.input}
        />
        <Pressable
          onPress={onTogglePassword}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          hitSlop={10}
          style={styles.eyeBtn}
        >
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={loginColors.textSecondary} />
        </Pressable>
      </View>
      {fieldErrors.password ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          ❌ {fieldErrors.password}
        </Text>
      ) : null}

      <View style={styles.rowBetween}>
        <Pressable
          onPress={() => onRememberMeChange(!rememberMe)}
          disabled={busy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberMe }}
          style={styles.rememberRow}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
            {rememberMe ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
          <Text style={styles.rememberText}>Remember me</Text>
        </Pressable>
        <Pressable onPress={onForgotPassword} disabled={busy} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.forgotText}>Forgot Password</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        accessibilityLabel={busy ? statusLabel : "Continue to sign in"}
        style={({ pressed }) => [
          styles.primaryBtn,
          loginButtonGradient(),
          pressed && !busy && styles.primaryBtnHover,
          busy && styles.primaryBtnDisabled
        ]}
      >
        {busy ? (
          <View style={styles.btnInner}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.primaryText}>{statusLabel}</Text>
          </View>
        ) : (
          <View style={styles.btnInner}>
            <Text style={styles.primaryText}>Continue</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerMuted}>
          Powered by <Text style={styles.footerBrand}>{SAAS_NAME}</Text>
        </Text>
        <Text style={styles.footerVersion}>{APP_VERSION}</Text>
      </View>
    </View>
  );
});

export function LoginView() {
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;
  const tablet = width >= 600;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "signing_in" | "loading_profile">("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
        if (saved?.trim()) {
          setEmail(saved.trim());
          setRememberMe(true);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const persistRememberEmail = useCallback(async (value: string, remember: boolean) => {
    try {
      if (remember && value.trim()) {
        await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, value.trim());
      } else {
        await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onBlurEmail = useCallback(() => {
    const err = validateEmail(email);
    setFieldErrors((prev) => ({ ...prev, email: err }));
  }, [email]);

  const onBlurPassword = useCallback(() => {
    const err = validatePassword(password);
    setFieldErrors((prev) => ({ ...prev, password: err }));
  }, [password]);

  const onForgotPassword = useCallback(() => {
    setFormError("Password reset is managed by your administrator. Contact them to reset your account.");
    setCanRetry(false);
  }, []);

  const onSubmit = useCallback(async () => {
    if (submitLock.current || busy) return;

    const errors = validateLoginForm(email, password);
    setFieldErrors(errors);
    setFormError(null);
    setCanRetry(false);

    if (errors.email || errors.password) return;

    submitLock.current = true;
    setBusy(true);
    setPhase("signing_in");

    try {
      await login(email.trim(), password);
      setPhase("loading_profile");
      await persistRememberEmail(email, rememberMe);
      // Root layout redirects by role once authReady + isAuthenticated.
    } catch (e) {
      const message = friendlyAuthMessage(e);
      setFormError(message);
      setCanRetry(message.includes("Unable to connect"));
      const state = useAuthStore.getState();
      if (state.authError?.toLowerCase().includes("profile not found")) {
        await logout().catch(() => {});
      }
    } finally {
      setBusy(false);
      setPhase("idle");
      submitLock.current = false;
    }
  }, [busy, email, login, logout, password, persistRememberEmail, rememberMe]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.bgGlowTop} pointerEvents="none" />
      <View style={styles.bgGlowBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          wide ? styles.scrollWide : tablet ? styles.scrollTablet : styles.scrollMobile
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.layout, wide && styles.layoutWide]}>
          <LoginBrandPanel wide={wide} />
          <View style={[styles.formColumn, wide && styles.formColumnWide, !wide && styles.formColumnCentered]}>
            <LoginFormCard
              compact={wide}
              onSubmit={() => void onSubmit()}
              busy={busy}
              phase={phase}
              email={email}
              password={password}
              showPassword={showPassword}
              rememberMe={rememberMe}
              fieldErrors={fieldErrors}
              formError={formError}
              canRetry={canRetry}
              onEmailChange={(v) => {
                setEmail(v);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: validateEmail(v) }));
              }}
              onPasswordChange={(v) => {
                setPassword(v);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: validatePassword(v) }));
              }}
              onTogglePassword={() => setShowPassword((s) => !s)}
              onRememberMeChange={setRememberMe}
              onForgotPassword={onForgotPassword}
              onBlurEmail={onBlurEmail}
              onBlurPassword={onBlurPassword}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: loginColors.bg,
    ...loginFont
  },
  bgGlowTop: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: loginColors.primaryGlow,
    opacity: 0.35
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -100,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(56,189,248,0.12)"
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center"
  },
  scrollWide: {
    paddingHorizontal: 40,
    paddingVertical: 48,
    minHeight: "100%" as unknown as number
  },
  scrollTablet: {
    paddingHorizontal: 32,
    paddingVertical: 32
  },
  scrollMobile: {
    paddingHorizontal: 20,
    paddingVertical: 24
  },
  layout: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center"
  },
  layoutWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32
  },
  brandPanel: {
    flex: 1,
    flexShrink: 1,
    minWidth: 300,
    maxWidth: 480,
    justifyContent: "center",
    paddingVertical: 16,
    paddingRight: 8
  },
  brandTop: {
    marginBottom: 40
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: loginColors.bgAccent,
    borderWidth: 1,
    borderColor: loginColors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  logoEmoji: {
    fontSize: 28
  },
  logoEmojiSmall: {
    fontSize: 32
  },
  brandRestaurant: {
    fontSize: 32,
    fontWeight: "800",
    color: loginColors.text,
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 6,
    ...(Platform.OS === "web" ? ({ whiteSpace: "normal" } as object) : null)
  },
  brandBranch: {
    fontSize: 15,
    fontWeight: "600",
    color: loginColors.primary,
    letterSpacing: 0.3,
    ...(Platform.OS === "web" ? ({ whiteSpace: "normal" } as object) : null)
  },
  illustrationWrap: {
    marginBottom: 36,
    position: "relative"
  },
  illustrationOrb: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
    height: 140,
    borderRadius: 24,
    backgroundColor: loginColors.primaryGlow,
    opacity: 0.25
  },
  illustrationCard: {
    borderRadius: loginRadius.card,
    borderWidth: 1,
    borderColor: loginColors.cardBorder,
    backgroundColor: loginColors.bgAccent,
    padding: 28,
    gap: 10
  },
  illustrationTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: loginColors.text,
    lineHeight: 26,
    ...(Platform.OS === "web" ? ({ whiteSpace: "normal" } as object) : null)
  },
  illustrationText: {
    fontSize: 15,
    lineHeight: 22,
    color: loginColors.textSecondary,
    ...(Platform.OS === "web" ? ({ whiteSpace: "normal" } as object) : null)
  },
  featureList: {
    gap: 14
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,122,0,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  featureLabel: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: loginColors.textSecondary,
    fontWeight: "500",
    ...(Platform.OS === "web" ? ({ whiteSpace: "normal" } as object) : null)
  },
  formColumn: {
    flexGrow: 0,
    flexShrink: 0,
    width: "100%",
    maxWidth: 440
  },
  formColumnWide: {
    flex: 0,
    width: 440,
    maxWidth: 440,
    paddingLeft: 56,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.08)"
  },
  formColumnCentered: {
    alignItems: "center",
    alignSelf: "center"
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: loginRadius.card,
    borderWidth: 1,
    borderColor: loginColors.cardBorder,
    backgroundColor: loginColors.card,
    padding: 32,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)"
        } as object)
      : null)
  },
  cardCompact: {
    maxWidth: 440
  },
  mobileBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: loginColors.cardBorder
  },
  mobileBrandText: {
    flex: 1
  },
  mobileRestaurant: {
    fontSize: 16,
    fontWeight: "700",
    color: loginColors.text
  },
  mobileBranch: {
    fontSize: 13,
    fontWeight: "600",
    color: loginColors.primary,
    marginTop: 2
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: loginColors.primary,
    marginBottom: 8
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: loginColors.text,
    letterSpacing: -0.5,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: loginColors.textSecondary,
    marginBottom: 24
  },
  formErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: loginColors.errorMuted,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16
  },
  formErrorText: {
    flex: 1,
    fontSize: 14,
    color: loginColors.error,
    fontWeight: "500"
  },
  retryLink: {
    fontSize: 14,
    fontWeight: "700",
    color: loginColors.primary
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: loginColors.text,
    marginBottom: 8
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: loginColors.inputBorder,
    borderRadius: loginRadius.input,
    backgroundColor: loginColors.inputBg,
    marginBottom: 6,
    minHeight: 52
  },
  inputWrapError: {
    borderColor: "rgba(239,68,68,0.55)",
    backgroundColor: loginColors.errorMuted
  },
  inputIcon: {
    marginLeft: 14
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 14 : 12,
    fontSize: 16,
    color: loginColors.text,
    ...loginFont,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null)
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  fieldError: {
    fontSize: 13,
    color: loginColors.error,
    marginBottom: 12,
    fontWeight: "500"
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 20,
    gap: 12,
    flexWrap: "wrap"
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: loginColors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: loginColors.inputBg
  },
  checkboxOn: {
    backgroundColor: loginColors.primary,
    borderColor: loginColors.primary
  },
  rememberText: {
    fontSize: 14,
    color: loginColors.textSecondary,
    fontWeight: "500"
  },
  forgotText: {
    fontSize: 14,
    color: loginColors.primary,
    fontWeight: "600",
    flexShrink: 0
  },
  primaryBtn: {
    width: "100%",
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: loginRadius.button,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ cursor: "pointer", transition: "transform 200ms ease, opacity 200ms ease" } as object)
      : null)
  },
  primaryBtnHover: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }]
  },
  primaryBtnDisabled: {
    opacity: 0.85
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    paddingHorizontal: 16
  },
  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  },
  footer: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: loginColors.cardBorder,
    alignItems: "center",
    gap: 4
  },
  footerMuted: {
    fontSize: 13,
    color: loginColors.textDim
  },
  footerBrand: {
    color: loginColors.textSecondary,
    fontWeight: "600"
  },
  footerVersion: {
    fontSize: 12,
    color: loginColors.textDim
  }
});
