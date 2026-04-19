"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  type User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import {
  resolveStaffAppRole,
  staffWebHomePathForRole,
  usersDocBlocksStaffAccess,
  type StaffAppRole,
  type StaffUsersDocFields
} from "@shared/utils/staff-access-control";
import { getFirebaseAuth, getFirebaseDb, logFirebaseConfigDebug } from "@/lib/firebase";
import { getRecaptchaToken } from "@/lib/recaptcha";

/** @deprecated Prefer {@link StaffAppRole} from `@shared/utils/staff-access-control`. */
export type AppRole = StaffAppRole;

export type { StaffAppRole };

const ROLE_SESSION_KEY = "staff_role_session";

export function routeForRole(role: StaffAppRole | null): string {
  if (!role) return "/login";
  return staffWebHomePathForRole(role);
}

type AuthContextValue = {
  user: User | null;
  role: StaffAppRole | null;
  initializing: boolean;
  isAuthenticated: boolean;
  /** Set when env/config is invalid so UI can show a fix hint */
  firebaseConfigError: string | null;
  /** False until `getIdTokenResult()` finishes for the current user. */
  authClaimsResolved: boolean;
  login: (email: string, password: string, honeypotWebsite?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<StaffAppRole | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authClaimsResolved, setAuthClaimsResolved] = useState(false);
  const [firebaseConfigError, setFirebaseConfigError] = useState<string | null>(null);
  const configErrorRef = useRef<string | null>(null);
  configErrorRef.current = firebaseConfigError;

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let authReady = false;
    const AUTH_INIT_MS = 20_000;

    const timeoutId = window.setTimeout(() => {
      if (authReady) return;
      unsub?.();
      unsub = undefined;
      setInitializing(false);
      setUser(null);
      setRole(null);
      setFirebaseConfigError((prev) => {
        if (prev) return prev;
        return (
          "Authentication did not initialize in time. Often caused by failed JavaScript loads (check the Network tab for " +
          "/_next/static/ 404s or MIME errors). Use http://localhost:3001 for the admin app, run `npm run clean` inside " +
          "admin-dashboard, then restart dev."
        );
      });
    }, AUTH_INIT_MS);

    try {
      if (process.env.NODE_ENV !== "production") {
        logFirebaseConfigDebug();
      }
      const auth = getFirebaseAuth();
      unsub = onAuthStateChanged(auth, (next) => {
        authReady = true;
        window.clearTimeout(timeoutId);
        setUser(next);
        setInitializing(false);
      });
    } catch (e) {
      authReady = true;
      window.clearTimeout(timeoutId);
      setInitializing(false);
      setUser(null);
      setRole(null);
      setFirebaseConfigError(e instanceof Error ? e.message : "Firebase configuration error.");
    }

    return () => {
      window.clearTimeout(timeoutId);
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) {
      setRole(null);
      window.localStorage.removeItem(ROLE_SESSION_KEY);
      setAuthClaimsResolved(true);
      return;
    }

    setAuthClaimsResolved(false);
    let cancelled = false;

    Promise.allSettled([
      user.getIdTokenResult(),
      getDoc(doc(getFirebaseDb(), "users", user.uid))
    ])
      .then(([tokenResult, userDocResult]) => {
        if (cancelled) return;

        if (userDocResult.status === "fulfilled" && userDocResult.value.exists()) {
          const data = userDocResult.value.data() as StaffUsersDocFields;
          if (usersDocBlocksStaffAccess(data)) {
            setRole(null);
            window.localStorage.removeItem(ROLE_SESSION_KEY);
            setAuthClaimsResolved(true);
            void signOut(getFirebaseAuth());
            return;
          }
        }

        const usersData =
          userDocResult.status === "fulfilled" && userDocResult.value.exists()
            ? (userDocResult.value.data() as StaffUsersDocFields)
            : null;

        const claimRole =
          tokenResult.status === "fulfilled" ? tokenResult.value.claims.role : undefined;

        const nextRole = resolveStaffAppRole(usersData ?? undefined, claimRole);

        if (!nextRole) {
          setRole(null);
          window.localStorage.removeItem(ROLE_SESSION_KEY);
          setAuthClaimsResolved(true);
          void signOut(getFirebaseAuth());
          return;
        }

        setRole(nextRole);
        window.localStorage.setItem(ROLE_SESSION_KEY, nextRole);
        setAuthClaimsResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setRole(null);
        window.localStorage.removeItem(ROLE_SESSION_KEY);
        setAuthClaimsResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const login = useCallback(async (email: string, password: string, honeypotWebsite = "") => {
    if (configErrorRef.current) {
      throw new Error(configErrorRef.current);
    }
    if (honeypotWebsite.trim()) {
      throw new Error("Invalid request.");
    }
    const auth = getFirebaseAuth();
    try {
      const recaptchaToken = await getRecaptchaToken("admin_login");
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "admin_login",
          email: email.trim(),
          password,
          recaptchaToken,
          website: honeypotWebsite
        })
      });
      const data = (await res.json()) as { customToken?: string; error?: string };
      if (!res.ok || !data.customToken) {
        throw new Error(data.error ?? "Sign-in failed.");
      }

      const cred = await signInWithCustomToken(auth, data.customToken);
      await cred.user.getIdToken(true);

      const snap = await getDoc(doc(getFirebaseDb(), "users", cred.user.uid));
      const profile = snap.exists() ? (snap.data() as StaffUsersDocFields) : null;
      if (usersDocBlocksStaffAccess(profile ?? undefined)) {
        await signOut(auth);
        throw new Error("Your account is not approved yet. Contact an administrator.");
      }

      const tokenResult = await cred.user.getIdTokenResult();
      const nextRole = resolveStaffAppRole(profile ?? undefined, tokenResult.claims.role);
      if (!nextRole) {
        await signOut(auth);
        throw new Error("No role is assigned for this account. Contact an administrator.");
      }
    } catch (err) {
      if (err instanceof FirebaseError) {
        throw err;
      }
      throw new Error(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }, []);

  const logout = useCallback(async () => {
    if (configErrorRef.current) {
      return;
    }
    try {
      await signOut(getFirebaseAuth());
    } catch (err) {
      if (err instanceof FirebaseError) {
        throw err;
      }
      throw new Error(err instanceof Error ? err.message : "Sign-out failed.");
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      initializing,
      isAuthenticated: Boolean(user),
      firebaseConfigError,
      authClaimsResolved,
      login,
      logout
    }),
    [user, role, initializing, firebaseConfigError, authClaimsResolved, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
