declare const process: { env: Record<string, string | undefined> };

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "../../store/useAuthStore";
import { friendlyAuthMessage } from "./auth-messages";
import { useResponsiveLayout } from "../../src/hooks/use-responsive-layout";
import {
  loginButtonGradient,
  loginCardShadow,
  loginColors,
  loginFont,
  loginGridLayout,
  loginHorizontalPadding,
  loginRadius,
  loginWebText
} from "./login-theme";
import { validateEmail, validateLoginForm, validatePassword, type FieldErrors } from "./login-validation";

const REMEMBER_EMAIL_KEY = "staff:remembered_email";
const HOTEL_NAME = process.env.EXPO_PUBLIC_HOTEL_NAME?.trim() || "Nausheen Fruits Juice Center";
const BRANCH_NAME = process.env.EXPO_PUBLIC_BRANCH_NAME?.trim() || "Main Branch";
const SAAS_NAME = "Fruit Hotel Platform";
const APP_VERSION = "v1.0";
const STAFF_LOGO = require("../../assets/staff-mobile-logo.png");

const FEATURES = [
  { icon: "restaurant-outline" as const, label: "Live order queue & kitchen tracking" },
  { icon: "card-outline" as const, label: "Fast billing & multi-platform POS" },
  { icon: "shield-checkmark-outline" as const, label: "Role-based secure staff access" }
] as const;

const LoginBrandPanel = memo(function LoginBrandPanel({ hotelName }: { hotelName: string }) {
  return (
    <View style={styles.brandPanel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.brandTop}>
        <View style={styles.logoMark}>
          <Image source={STAFF_LOGO} style={styles.logoImage} resizeMode="cover" accessibilityLabel="Restaurant logo" />
        </View>
        <Text style={styles.brandRestaurant}>{hotelName}</Text>
        <Text style={styles.brandTagline}>{BRANCH_NAME}</Text>
        <Text style={styles.brandSubtitle}>Premium staff workspace for modern restaurant operations.</Text>
      </View>

      <View style={styles.illustrationWrap}>
        <View style={styles.illustrationCard}>
          <View style={styles.illustrationIconWrap}>
            <Ionicons name="sparkles" size={24} color={loginColors.primary} />
          </View>
          <Text style={styles.illustrationTitle}>Everything your floor team needs</Text>
          <Text style={styles.illustrationText}>
            Orders, billing, kitchen, and delivery — unified in one secure login.
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
  showMobileBrand: boolean;
  hotelName: string;
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
  showMobileBrand,
  hotelName,
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
    phase === "signing_in" ? "Signing in…" : phase === "loading_profile" ? "Loading profile…" : "Sign in";

  return (
    <View style={[styles.card, loginCardShadow()]}>
      {showMobileBrand ? (
        <View style={styles.mobileBrand}>
          <View style={styles.logoMarkSmall}>
            <Image source={STAFF_LOGO} style={styles.logoImageSmall} resizeMode="cover" accessibilityLabel="Restaurant logo" />
          </View>
          <View style={styles.mobileBrandText}>
            <Text style={styles.mobileRestaurant}>{hotelName}</Text>
            <Text style={styles.mobileBranch}>{BRANCH_NAME}</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.kicker}>STAFF APP</Text>
      <Text style={styles.title} accessibilityRole="header">
        Welcome Back
      </Text>
      <Text style={styles.subtitle}>Sign in to continue managing restaurant operations.</Text>

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
          placeholder="you@restaurant.com"
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
          {fieldErrors.email}
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
          {fieldErrors.password}
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
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        accessibilityLabel={busy ? statusLabel : "Sign in"}
        style={({ pressed }) => [
          styles.primaryBtn,
          loginButtonGradient(),
          pressed && !busy && styles.primaryBtnPressed,
          busy && styles.primaryBtnDisabled
        ]}
      >
        {busy ? (
          <View style={styles.btnInner}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.primaryText}>{statusLabel}</Text>
          </View>
        ) : (
          <Text style={styles.primaryText}>Sign in</Text>
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
  const { width, height, isTablet, loginFormMaxWidth } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const isTabletLayout = isTablet;

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

  const padX = loginHorizontalPadding(width);

  const gridStyle = useMemo(() => loginGridLayout(width, isTabletLayout), [width, isTabletLayout]);

  const formColumnStyle = useMemo(
    (): ViewStyle =>
      isTabletLayout
        ? { width: "100%", maxWidth: loginFormMaxWidth, flexShrink: 0, flexGrow: 0 }
        : { width: "100%", flex: 1 },
    [isTabletLayout, loginFormMaxWidth]
  );

  const webScreenStyle = useMemo(
    (): ViewStyle =>
      Platform.OS === "web"
        ? ({
            minHeight: "100vh",
            height: "100%",
            width: "100%",
            overflow: "hidden"
          } as unknown as ViewStyle)
        : {},
    []
  );

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
    setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
  }, [email]);

  const onBlurPassword = useCallback(() => {
    setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }));
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

  const formProps: LoginFormProps = {
    showMobileBrand: !isTabletLayout,
    hotelName: HOTEL_NAME,
    onSubmit: () => void onSubmit(),
    busy,
    phase,
    email,
    password,
    showPassword,
    rememberMe,
    fieldErrors,
    formError,
    canRetry,
    onEmailChange: (v) => {
      setEmail(v);
      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: validateEmail(v) }));
    },
    onPasswordChange: (v) => {
      setPassword(v);
      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: validatePassword(v) }));
    },
    onTogglePassword: () => setShowPassword((s) => !s),
    onRememberMeChange: setRememberMe,
    onForgotPassword,
    onBlurEmail,
    onBlurPassword
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, webScreenStyle, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.bgLayer} pointerEvents="none">
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: padX,
            width: "100%",
            minHeight: Platform.OS === "web" ? ("100%" as unknown as number) : Math.max(height - insets.top - insets.bottom, 0)
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.page, gridStyle]}>
          {isTabletLayout ? (
            <View style={styles.brandColumn}>
              <LoginBrandPanel hotelName={HOTEL_NAME} />
            </View>
          ) : null}

          <View style={[styles.formColumn, formColumnStyle]}>
            <LoginFormCard {...formProps} />
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
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: "hidden"
  },
  bgGlowTop: {
    position: "absolute",
    top: "-18%",
    right: "-12%",
    width: "55%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: loginColors.primaryGlow,
    opacity: 0.55
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: "-15%",
    left: "-10%",
    width: "48%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "rgba(56,189,248,0.1)"
  },
  scroll: {
    flex: 1,
    width: "100%",
    zIndex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    width: "100%",
    paddingVertical: 32
  },
  page: {
    width: "100%",
    flex: 1
  },
  brandColumn: {
    flex: 1,
    minWidth: 0,
    width: "100%"
  },
  brandPanel: {
    width: "100%",
    minWidth: 0,
    paddingVertical: 8,
    ...(Platform.OS === "web" ? ({ overflow: "visible" } as object) : null)
  },
  brandTop: {
    marginBottom: 32,
    width: "100%"
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20
  },
  logoMarkSmall: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: "hidden"
  },
  logoImage: {
    width: "100%",
    height: "100%"
  },
  logoImageSmall: {
    width: "100%",
    height: "100%"
  },
  brandRestaurant: {
    fontSize: 32,
    fontWeight: "800",
    color: loginColors.text,
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 6,
    ...loginWebText
  },
  brandTagline: {
    fontSize: 15,
    fontWeight: "600",
    color: loginColors.primary,
    letterSpacing: 0.2,
    marginBottom: 10,
    ...loginWebText
  },
  brandSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: loginColors.textSecondary,
    width: "100%",
    ...loginWebText
  },
  illustrationWrap: {
    marginBottom: 28,
    width: "100%"
  },
  illustrationCard: {
    borderRadius: loginRadius.card,
    borderWidth: 1,
    borderColor: loginColors.cardBorder,
    backgroundColor: loginColors.bgAccent,
    padding: 24,
    gap: 8,
    width: "100%"
  },
  illustrationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,122,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  illustrationTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: loginColors.text,
    lineHeight: 26,
    ...loginWebText
  },
  illustrationText: {
    fontSize: 14,
    lineHeight: 22,
    color: loginColors.textSecondary,
    ...loginWebText
  },
  featureList: {
    gap: 12,
    width: "100%"
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
    justifyContent: "center",
    flexShrink: 0
  },
  featureLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: loginColors.textSecondary,
    fontWeight: "500",
    ...loginWebText
  },
  formColumn: {
    width: "100%",
    ...(Platform.OS === "web" ? ({ justifySelf: "stretch" } as object) : null)
  },
  card: {
    width: "100%",
    borderRadius: loginRadius.card,
    borderWidth: 1,
    borderColor: loginColors.cardBorder,
    backgroundColor: loginColors.card,
    padding: 28,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)"
        } as object)
      : null)
  },
  mobileBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: loginColors.cardBorder
  },
  mobileBrandText: {
    flex: 1,
    minWidth: 0
  },
  mobileRestaurant: {
    fontSize: 17,
    fontWeight: "700",
    color: loginColors.text,
    ...loginWebText
  },
  mobileBranch: {
    fontSize: 13,
    fontWeight: "600",
    color: loginColors.primary,
    marginTop: 2,
    ...loginWebText
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: loginColors.primary,
    marginBottom: 8,
    ...loginWebText
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: loginColors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
    ...loginWebText
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: loginColors.textSecondary,
    marginBottom: 24,
    ...loginWebText
  },
  formErrorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    minWidth: 0,
    fontSize: 14,
    color: loginColors.error,
    fontWeight: "500",
    ...loginWebText
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
    marginBottom: 8,
    ...loginWebText
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: loginColors.inputBorder,
    borderRadius: loginRadius.input,
    backgroundColor: loginColors.inputBg,
    marginBottom: 4,
    minHeight: 50,
    width: "100%"
  },
  inputWrapError: {
    borderColor: "rgba(239,68,68,0.55)",
    backgroundColor: loginColors.errorMuted
  },
  inputIcon: {
    marginLeft: 14,
    flexShrink: 0
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
    paddingVertical: 12,
    flexShrink: 0
  },
  fieldError: {
    fontSize: 13,
    color: loginColors.error,
    marginBottom: 12,
    fontWeight: "500",
    ...loginWebText
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
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
    fontWeight: "500",
    ...loginWebText
  },
  forgotText: {
    fontSize: 14,
    color: loginColors.primary,
    fontWeight: "600",
    flexShrink: 0
  },
  primaryBtn: {
    width: "100%",
    minHeight: 50,
    borderRadius: loginRadius.button,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ cursor: "pointer", transition: "opacity 180ms ease, transform 180ms ease" } as object)
      : null)
  },
  primaryBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }]
  },
  primaryBtnDisabled: {
    opacity: 0.85
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  },
  footer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: loginColors.cardBorder,
    alignItems: "center",
    gap: 4
  },
  footerMuted: {
    fontSize: 13,
    color: loginColors.textDim,
    textAlign: "center",
    ...loginWebText
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
