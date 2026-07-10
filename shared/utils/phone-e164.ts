/**
 * Normalize a phone string to E.164.
 * Bare 10-digit numbers default to India (+91).
 */
export function normalizePhoneE164(raw: string, defaultCountryCode = "91"): string {
  const input = String(raw ?? "").trim().replace(/\s/g, "");
  if (!input) return "";
  if (input.startsWith("+")) {
    const digits = input.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return digits ? `+${defaultCountryCode}${digits}` : "";
}

export function isValidE164(phone: string): boolean {
  return /^\+\d{8,15}$/.test(phone);
}
