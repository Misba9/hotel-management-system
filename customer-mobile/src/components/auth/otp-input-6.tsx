import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";

const LEN = 6;

export type OtpInput6Props = {
  digits: string[];
  onDigitsChange: (next: string[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function otpDigitsToString(digits: string[]): string {
  return digits
    .map((d) => (/\d/.test(d) ? d : ""))
    .join("")
    .slice(0, LEN);
}

export function OtpInput6({
  digits,
  onDigitsChange,
  disabled = false,
  autoFocus = true
}: OtpInput6Props) {
  const colors = useThemeColors();
  const refs = useRef<(TextInput | null)[]>([]);
  const safeDigits = Array.from({ length: LEN }, (_, i) =>
    digits[i] && /\d/.test(digits[i]!) ? digits[i]! : ""
  );

  const focusAt = useCallback((index: number) => {
    const i = Math.max(0, Math.min(LEN - 1, index));
    requestAnimationFrame(() => refs.current[i]?.focus());
  }, []);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => refs.current[0]?.focus(), 80);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const onChangeAt = useCallback(
    (index: number, raw: string) => {
      const only = raw.replace(/\D/g, "");
      if (only.length > 1) {
        const next = [...safeDigits];
        for (let j = 0; j < only.length && index + j < LEN; j++) {
          next[index + j] = only[j]!;
        }
        onDigitsChange(next);
        focusAt(Math.min(index + only.length, LEN - 1));
        return;
      }
      const d = only.slice(-1);
      const next = [...safeDigits];
      next[index] = d;
      onDigitsChange(next);
      if (d && index < LEN - 1) focusAt(index + 1);
    },
    [safeDigits, onDigitsChange, focusAt]
  );

  return (
    <View style={styles.row}>
      {safeDigits.map((digit, i) => (
        <TextInput
          key={`otp-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          editable={!disabled}
          keyboardType="number-pad"
          textContentType={i === 0 ? "oneTimeCode" : "none"}
          autoComplete={i === 0 ? "sms-otp" : "off"}
          maxLength={Platform.OS === "android" ? 6 : 1}
          selectTextOnFocus
          style={[
            styles.box,
            {
              backgroundColor: colors.surface,
              borderColor: digit ? colors.primary : colors.border,
              color: colors.textPrimary
            }
          ]}
          onChangeText={(t) => onChangeAt(i, t)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "Backspace") {
              if (safeDigits[i]) {
                const next = [...safeDigits];
                next[i] = "";
                onDigitsChange(next);
              } else if (i > 0) {
                const next = [...safeDigits];
                next[i - 1] = "";
                onDigitsChange(next);
                focusAt(i - 1);
              }
            }
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 8 },
  box: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700"
  }
});
