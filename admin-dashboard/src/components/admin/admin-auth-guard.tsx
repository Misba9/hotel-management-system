"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { routeForRole, type AppRole, useAuth } from "@/context/AuthContext";
import { FirebaseConfigErrorPanel } from "@/components/auth/firebase-config-error-panel";
import { Loader2 } from "lucide-react";

type Props = {
  children: ReactNode;
  allowedRoles?: AppRole[];
};

export function AdminAuthGuard({ children, allowedRoles }: Props) {
  const { user, role, initializing, authClaimsResolved, firebaseConfigError } = useAuth();
  const router = useRouter();
  const roleAllowed = !allowedRoles || (role != null && allowedRoles.includes(role));

  useEffect(() => {
    if (initializing || !authClaimsResolved || firebaseConfigError) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!roleAllowed) {
      router.replace(routeForRole(role));
    }
  }, [user, role, roleAllowed, initializing, authClaimsResolved, firebaseConfigError, router]);

  if (firebaseConfigError) {
    return <FirebaseConfigErrorPanel message={firebaseConfigError} />;
  }

  if (initializing || !authClaimsResolved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
        <Loader2 className="h-10 w-10 animate-spin text-brand-primary" aria-hidden />
        <p className="text-sm font-medium">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Redirecting to login…
      </div>
    );
  }

  if (!roleAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Redirecting to your dashboard…
      </div>
    );
  }

  return <>{children}</>;
}
