export type FieldErrors = {
  email?: string;
  password?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

const COMMON_EMAIL_TYPO_TLDS = [
  /\.comc$/i,
  /\.con$/i,
  /\.cpm$/i,
  /\.comm$/i,
  /\.ocm$/i,
  /\.coom$/i,
  /\.gmal\.com$/i,
  /\.gmial\.com$/i,
  /\.gamil\.com$/i
];

export function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required";
  if (!EMAIL_RE.test(trimmed)) return "Invalid email";
  if (COMMON_EMAIL_TYPO_TLDS.some((re) => re.test(trimmed))) {
    return "Invalid email — check the domain spelling (e.g. .com)";
  }
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required";
  if (value.length < 6) return "Password must be at least 6 characters";
  return undefined;
}

export function validateLoginForm(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const emailErr = validateEmail(email);
  const passwordErr = validatePassword(password);
  if (emailErr) errors.email = emailErr;
  if (passwordErr) errors.password = passwordErr;
  return errors;
}
