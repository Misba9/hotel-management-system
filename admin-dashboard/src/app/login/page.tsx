import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the admin dashboard"
};

/**
 * Optional demo pre-fill (server-only env — not NEXT_PUBLIC):
 * `ADMIN_DEMO_EMAIL` / `ADMIN_DEMO_PASSWORD` in `.env.local`
 * Create the same user in Firebase Authentication (Email/Password).
 */
export default function LoginPage() {
  const defaultEmail = process.env.ADMIN_DEMO_EMAIL ?? "";
  const defaultPassword = process.env.ADMIN_DEMO_PASSWORD ?? "";

  return <LoginForm defaultEmail={defaultEmail} defaultPassword={defaultPassword} />;
}
