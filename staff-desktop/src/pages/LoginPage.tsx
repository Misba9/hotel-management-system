import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { homePathForRole } from "@/lib/role-routes";

const REMEMBER_EMAIL_KEY = "staff-desktop-remember-email";

const labelClass = "block text-sm font-semibold text-theme-text-primary";
const inputClass =
  "theme-input mt-1 h-12 w-full rounded-xl border border-theme-border bg-theme-input-bg px-4 text-sm text-theme-text-primary outline-none focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/20";

export function LoginPage() {
  const { login, profile, loading, authError } = useAuth();
  const { mode, toggle } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (saved) setEmail(saved);
  }, []);

  if (profile) {
    return <Navigate to={homePathForRole(profile.role)} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const nextProfile = await login(email, password);
      if (rememberEmail) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_EMAIL_KEY);
      navigate(homePathForRole(nextProfile.role));
    } catch {
      // authError set in context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-theme-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-theme-primary/20 via-theme-background to-theme-primary/10" />

      <button
        type="button"
        onClick={toggle}
        className="absolute right-6 top-6 z-10 rounded-lg border border-theme-border bg-theme-card px-3 py-2 text-xs font-bold text-theme-text-secondary shadow-card transition hover:text-theme-primary"
        title="Toggle theme"
      >
        {mode === "dark" ? "☀️ Light" : "🌙 Dark"}
      </button>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="theme-card-elevated relative z-[1] w-full max-w-md rounded-2xl border border-theme-border p-8 shadow-2xl"
      >
        <div className="mb-6 text-center">
          <div className="text-4xl">🍍</div>
          <h1 className="mt-2 text-2xl font-extrabold text-theme-text-primary">Nausheen Staff Desktop</h1>
          <p className="mt-1 text-sm text-theme-text-secondary">Sign in with your staff account</p>
        </div>

        <label className={labelClass}>
          Email
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className={`mt-4 ${labelClass}`}>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-theme-text-secondary">
          <input
            type="checkbox"
            checked={rememberEmail}
            onChange={(e) => setRememberEmail(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--theme-primary)]"
          />
          Remember email
        </label>

        {authError ? (
          <p className="mt-4 rounded-lg border border-theme-danger/30 bg-theme-danger-muted px-3 py-2 text-sm text-theme-danger">
            {authError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || loading}
          className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-theme-primary text-sm font-bold text-white shadow-glow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
