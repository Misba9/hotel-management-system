import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";

export default function ForgotPasswordScreen() {
  const colors = useThemeColors();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Forgot password" />
      <View style={styles.body}>
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          Password reset is handled through email sign-in on the web portal. Contact support if you need help
          recovering your account.
        </Text>
        <Link href="/auth/login" style={[styles.link, { color: colors.primary }]}>
          Back to sign in
        </Link>
        <Link href="/auth/otp-verification" style={[styles.link, { color: colors.primary, marginTop: 16 }]}>
          Sign in with phone OTP instead
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: 24 },
  text: { fontSize: 15, lineHeight: 22 },
  link: { marginTop: 24, fontWeight: "700", fontSize: 15 }
});
