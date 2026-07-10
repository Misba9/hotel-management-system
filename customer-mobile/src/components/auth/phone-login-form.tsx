import { useCallback, useEffect, useRef, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { isValidE164, normalizePhoneE164 } from "@shared/utils/phone-e164";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { OtpInput6, otpDigitsToString } from "@/src/components/auth/otp-input-6";
import { auth } from "@/src/lib/firebase";
import { apiFetch, getApiBaseUrl } from "@/src/lib/api";
import { logAuthError, mapPhoneAuthError } from "@/src/lib/phone-auth-errors";

type OtpChannel = "sms" | "whatsapp";
type Step = "phone" | "otp";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

type Props = {
  onSuccess?: () => void;
  onAuthBusyChange?: (busy: boolean) => void;
  initialPhone?: string;
  autoSend?: boolean;
};

export function PhoneLoginForm({
  onSuccess,
  onAuthBusyChange,
  initialPhone = "",
  autoSend = false
}: Props) {
  const colors = useThemeColors();
  const [phone, setPhone] = useState(initialPhone);
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [channel, setChannel] = useState<OtpChannel>("sms");
  const [cooldown, setCooldown] = useState(0);
  const [otpKey, setOtpKey] = useState(0);
  const phoneE164Ref = useRef("");
  const verifyLockRef = useRef(false);
  const sendLockRef = useRef(false);
  const autoSentRef = useRef(false);

  useEffect(() => {
    onAuthBusyChange?.(loading && step === "otp");
  }, [loading, step, onAuthBusyChange]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = useCallback(
    async (preferred: OtpChannel = "sms") => {
      if (sendLockRef.current || loading) return;
      setError(null);
      setInfo(null);

      const e164 = normalizePhoneE164(phone);
      // eslint-disable-next-line no-console
      console.log("[PhoneOTP] Raw phone:", phone, "→ E.164:", e164, "API:", getApiBaseUrl());

      if (!isValidE164(e164)) {
        setError("Enter a valid phone number with country code (e.g. +919059899298).");
        return;
      }

      phoneE164Ref.current = e164;
      sendLockRef.current = true;
      setLoading(true);
      try {
        const trySend = async (ch: OtpChannel) => {
          const path = ch === "sms" ? "/api/auth/sms-otp/send" : "/api/auth/whatsapp-otp/send";
          // eslint-disable-next-line no-console
          console.log("[PhoneOTP] Sending via", ch, "to", e164);
          const res = await apiFetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: e164 })
          });
          let data: { ok?: boolean; error?: string; channel?: string } = {};
          const raw = await res.text();
          try {
            data = raw ? (JSON.parse(raw) as typeof data) : {};
          } catch (parseErr) {
            logAuthError("PhoneOTP.send.parse", parseErr);
            if (res.status === 404 || raw.trimStart().startsWith("<")) {
              data = {
                error:
                  "API route not found (got HTML). Restart customer-web: rm -rf customer-web/.next && npm run dev -p 3000"
              };
            }
          }
          // eslint-disable-next-line no-console
          console.log("[PhoneOTP] Send response", { status: res.status, data, channel: ch });
          return { res, data, ch };
        };

        let result = await trySend(preferred);
        // Don't fall back to WhatsApp when SMS is merely unconfigured (503) — same Twilio account.
        if (!result.res.ok && preferred === "sms" && result.res.status !== 503) {
          // eslint-disable-next-line no-console
          console.log("[PhoneOTP] SMS failed — trying WhatsApp fallback");
          result = await trySend("whatsapp");
        }
        if (!result.res.ok || result.data.ok === false) {
          const msg =
            result.data.error ||
            (result.res.status === 503
              ? "SMS is not configured on the server. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SMS_FROM in customer-web/.env.local."
              : result.res.status === 404
                ? "API route missing. Restart customer-web with a clean .next build."
                : "Could not send OTP. Please try again.");
          setError(msg);
          return;
        }

        setChannel(result.ch);
        setStep("otp");
        setDigits(Array(OTP_LENGTH).fill(""));
        setOtpKey((k) => k + 1);
        verifyLockRef.current = false;
        setCooldown(RESEND_SECONDS);
        setInfo(
          result.ch === "sms" ? `SMS code sent to ${e164}` : `WhatsApp code sent to ${e164}`
        );
      } catch (err) {
        logAuthError("PhoneOTP.send", err);
        setError(mapPhoneAuthError(err, "send"));
      } finally {
        setLoading(false);
        sendLockRef.current = false;
      }
    },
    [phone, loading]
  );

  useEffect(() => {
    if (autoSend && initialPhone && !autoSentRef.current) {
      autoSentRef.current = true;
      void sendOtp("sms");
    }
  }, [autoSend, initialPhone, sendOtp]);

  const verifyOtp = useCallback(
    async (code: string) => {
      if (verifyLockRef.current || loading) return;
      if (!/^\d{6}$/.test(code)) {
        setError("Enter the 6-digit code.");
        return;
      }
      const e164 = phoneE164Ref.current || normalizePhoneE164(phone);
      if (!isValidE164(e164)) {
        setError("Enter a valid phone number with country code (e.g. +919059899298).");
        return;
      }

      verifyLockRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const path = channel === "sms" ? "/api/auth/sms-otp/verify" : "/api/auth/whatsapp-otp/verify";
        // eslint-disable-next-line no-console
        console.log("[PhoneOTP] Verifying", { e164, channel, codeLength: code.length });
        const res = await apiFetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: e164, otp: code })
        });
        const data = (await res.json()) as { ok?: boolean; customToken?: string; error?: string };
        // eslint-disable-next-line no-console
        console.log("[PhoneOTP] Verify response", { status: res.status, ok: data.ok, hasToken: Boolean(data.customToken) });
        if (!res.ok || !data.customToken) {
          setError(data.error || "Invalid OTP. Try again.");
          verifyLockRef.current = false;
          return;
        }
        await signInWithCustomToken(auth, data.customToken);
        onSuccess?.();
      } catch (err) {
        logAuthError("PhoneOTP.verify", err);
        setError(mapPhoneAuthError(err, "verify"));
        verifyLockRef.current = false;
      } finally {
        setLoading(false);
      }
    },
    [channel, phone, onSuccess, loading]
  );

  const handleDigitsChange = useCallback(
    (next: string[]) => {
      setError(null);
      verifyLockRef.current = false;
      setDigits(next);
      const code = otpDigitsToString(next);
      if (code.length === OTP_LENGTH) {
        void verifyOtp(code);
      }
    },
    [verifyOtp]
  );

  return (
    <View style={styles.wrap}>
      {step === "phone" ? (
        <>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Sign in with phone OTP. We&apos;ll text a one-time code to your mobile.
          </Text>
          <Input
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+91 9059899298"
            autoComplete="tel"
            textContentType="telephoneNumber"
            editable={!loading}
          />
          <Text style={[styles.testHint, { color: colors.textSecondary }]}>
            Always include country code (E.164), e.g. +919059899298 — never send 9059899298 alone.
          </Text>
          {__DEV__ ? (
            <Text style={[styles.debug, { color: colors.textSecondary }]}>
              API: {getApiBaseUrl()}
            </Text>
          ) : null}
          {error ? (
            <Text style={[styles.errorBox, { backgroundColor: colors.dangerMuted, color: colors.danger }]}>
              {error}
            </Text>
          ) : null}
          <Button
            title={loading ? "Sending…" : "Send OTP"}
            onPress={() => void sendOtp("sms")}
            loading={loading}
            disabled={loading || !phone.trim()}
          />
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textSecondary, marginLeft: 8 }}>Sending OTP…</Text>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Enter 6-digit OTP
            {info ? ` — ${info}` : ""}
          </Text>
          <OtpInput6 key={otpKey} digits={digits} onDigitsChange={handleDigitsChange} disabled={loading} />
          {error ? (
            <Text
              style={[
                styles.errorBox,
                { backgroundColor: colors.dangerMuted, color: colors.danger, marginTop: 12 }
              ]}
            >
              {error}
            </Text>
          ) : null}
          <View style={{ height: 16 }} />
          <Button
            title={loading ? "Verifying…" : "Verify OTP"}
            onPress={() => void verifyOtp(otpDigitsToString(digits))}
            loading={loading}
            disabled={loading}
          />
          <View style={styles.secondaryRow}>
            <Pressable
              disabled={loading}
              onPress={() => {
                setStep("phone");
                setDigits(Array(OTP_LENGTH).fill(""));
                setInfo(null);
                setError(null);
                verifyLockRef.current = false;
              }}
            >
              <Text style={[styles.link, { color: colors.primary }]}>Change phone</Text>
            </Pressable>
            <Pressable disabled={loading || cooldown > 0} onPress={() => void sendOtp(channel)}>
              <Text style={[styles.link, { color: cooldown > 0 ? colors.textSecondary : colors.primary }]}>
                {cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
              </Text>
            </Pressable>
          </View>
          {channel === "sms" ? (
            <Pressable
              disabled={loading || cooldown > 0}
              onPress={() => void sendOtp("whatsapp")}
              style={{ marginTop: 10, alignItems: "center" }}
            >
              <Text style={[styles.link, { color: colors.primary }]}>Send via WhatsApp instead</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 16, textAlign: "center" },
  testHint: { fontSize: 12, marginTop: -8, marginBottom: 8 },
  debug: { fontSize: 11, marginBottom: 12, fontFamily: "Menlo" },
  errorBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 12,
    overflow: "hidden"
  },
  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12 },
  secondaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingHorizontal: 4
  },
  link: { fontSize: 14, fontWeight: "700" }
});
