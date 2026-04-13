"use client";

import { useCallback, useEffect, useRef } from "react";

const LEN = 6;

const boxClass =
  "h-12 w-10 rounded-lg border border-slate-300 bg-white text-center text-lg tabular-nums text-slate-900 outline-none transition placeholder:text-transparent " +
  "focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-500";

export type OtpInput6Props = {
  /** Six slots; use `''` for empty. */
  digits: string[];
  onDigitsChange: (next: string[]) => void;
  disabled?: boolean;
  /** Focus first cell when the OTP step mounts. Default true. */
  autoFocus?: boolean;
  /** Prefix for input ids (e.g. recaptcha container id) for uniqueness. */
  idPrefix?: string;
  className?: string;
};

/** Combined OTP string from six digit slots (non-digits stripped). */
export function otpDigitsToString(digits: string[]): string {
  return digits.map((d) => (/\d/.test(d) ? d : "")).join("").slice(0, LEN);
}

export function OtpInput6({
  digits,
  onDigitsChange,
  disabled = false,
  autoFocus = true,
  idPrefix = "otp",
  className = ""
}: OtpInput6Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const safeDigits = Array.from({ length: LEN }, (_, i) => (digits[i] && /\d/.test(digits[i]) ? digits[i] : ""));

  const focusAt = useCallback((index: number) => {
    window.requestAnimationFrame(() => {
      refs.current[Math.max(0, Math.min(LEN - 1, index))]?.focus();
    });
  }, []);

  /** Focus first cell once when this instance mounts (new step or `key` remount). */
  useEffect(() => {
    if (!autoFocus) return;
    const t = window.setTimeout(() => refs.current[0]?.focus(), 50);
    return () => window.clearTimeout(t);
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
      if (d && index < LEN - 1) {
        focusAt(index + 1);
      }
    },
    [safeDigits, onDigitsChange, focusAt]
  );

  const onKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (safeDigits[index]) {
          const next = [...safeDigits];
          next[index] = "";
          onDigitsChange(next);
        } else if (index > 0) {
          refs.current[index - 1]?.focus();
          const next = [...safeDigits];
          next[index - 1] = "";
          onDigitsChange(next);
        }
        e.preventDefault();
      }
      if (e.key === "ArrowLeft" && index > 0) {
        refs.current[index - 1]?.focus();
        e.preventDefault();
      }
      if (e.key === "ArrowRight" && index < LEN - 1) {
        refs.current[index + 1]?.focus();
        e.preventDefault();
      }
    },
    [safeDigits, onDigitsChange]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LEN);
      if (!pasted) return;
      const next = Array(LEN)
        .fill("")
        .map((_, i) => pasted[i] ?? "");
      onDigitsChange(next);
      focusAt(Math.min(pasted.length, LEN - 1));
    },
    [onDigitsChange, focusAt]
  );

  return (
    <div className={`flex justify-center gap-2 ${className}`.trim()}>
      {safeDigits.map((digit, i) => (
        <input
          key={`${idPrefix}-otp-slot-${i}`}
          id={`${idPrefix}-otp-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          aria-label={`Digit ${i + 1} of ${LEN}`}
          disabled={disabled}
          className={boxClass}
          onChange={(e) => onChangeAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
        />
      ))}
    </div>
  );
}
