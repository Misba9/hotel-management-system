import { Image } from "expo-image";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { AuthMethodTabs, type AuthTab } from "@/src/components/auth/auth-method-tabs";

const CUSTOMER_LOGO = require("../../assets/customer-mobile-logo.png");

export default function LoginScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    tab?: string;
    phone?: string;
    autoSend?: string;
    mode?: string;
  }>();

  const defaultTab: AuthTab =
    params.tab === "email" || params.tab === "google" || params.tab === "apple" || params.tab === "phone"
      ? params.tab
      : "phone";

  return (
    <KeyboardAvoidingView
      style={[styles.wrap, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Image source={CUSTOMER_LOGO} style={styles.logo} contentFit="cover" accessibilityLabel="Nausheen Fruits logo" />
        </View>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>Login</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Sign in with phone (OTP), email, Google, or Apple. Enable each provider in Firebase Console
          → Authentication.
        </Text>

        <AuthMethodTabs
          defaultTab={defaultTab}
          emailMode={params.mode === "signup" ? "signup" : "signin"}
          initialPhone={params.phone}
          autoSendPhone={params.autoSend === "1"}
          onSuccess={() => {
            router.replace("/(tabs)/home");
          }}
        />

        {__DEV__ ? (
          <Link href="/firebase-debug" style={[styles.debugLink, { color: colors.textSecondary }]}>
            Firebase debug
          </Link>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 56, paddingBottom: 40 },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20
  },
  logo: {
    width: "100%",
    height: "100%"
  },
  heading: { fontSize: 28, fontWeight: "900", letterSpacing: -0.3 },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 24 },
  debugLink: { textAlign: "center", marginTop: 28, fontSize: 13, fontWeight: "600" }
});
