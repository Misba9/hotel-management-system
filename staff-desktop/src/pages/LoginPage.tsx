import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { homePathForRole } from "@/lib/role-routes";

const REMEMBER_EMAIL_KEY = "staff-desktop-remember-email";

export function LoginPage() {
  const { login, profile, loading, authError } = useAuth();
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-900 via-slate-900 to-emerald-900 p-6">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur"
      >
        <div className="mb-6 text-center">
          <div className="text-4xl">🍍</div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Nausheen Staff Desktop</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your staff account</p>
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          Email
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={rememberEmail}
            onChange={(e) => setRememberEmail(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Remember email
        </label>

        {authError ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || loading}
          className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand-teal text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
