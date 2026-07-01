import { signInWithCustomToken } from "firebase/auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { auth } from "@/src/lib/firebase";
import { apiFetch } from "@/src/lib/api";

export default function OtpVerificationScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(params.phone || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp() {
    setError("");
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/whatsapp-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+91${normalized.slice(-10)}` })
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error || "Could not send OTP.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError("");
    if (otp.length < 4) {
      setError("Enter the OTP you received.");
      return;
    }
    setLoading(true);
    try {
      const normalized = phone.replace(/\D/g, "");
      const res = await apiFetch("/api/auth/whatsapp-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+91${normalized.slice(-10)}`, otp })
      });
      const data = (await res.json()) as { customToken?: string; error?: string };
      if (!res.ok || !data.customToken) {
        setError(data.error || "Invalid OTP.");
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
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Verify OTP" />
      <View style={styles.body}>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          We'll send a one-time code via WhatsApp
        </Text>
        <Input label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" />
        {sent ? (
          <Input label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
        ) : null}
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <Button
          title={sent ? "Verify & continue" : "Send OTP"}
          onPress={sent ? verifyOtp : sendOtp}
          loading={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: 24 },
  sub: { fontSize: 14, marginBottom: 24 },
  error: { fontSize: 13, marginBottom: 12 }
});
