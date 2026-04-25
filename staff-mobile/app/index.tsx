import { Redirect } from "expo-router";

import { roleHomeHref } from "../src/lib/staff-role-home";
import { useAuthStore } from "../store/useAuthStore";

export default function Index() {
  const authReady = useAuthStore((s) => s.authReady);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  if (!authReady || loading) {
    return null;
  }

  if (!user || !isAuthenticated || !role) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={roleHomeHref(role)} />;
}
