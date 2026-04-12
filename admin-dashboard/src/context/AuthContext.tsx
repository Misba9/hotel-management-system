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
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { getFirebaseAuth, getFirebaseDb, logFirebaseConfigDebug } from "@/lib/firebase";

export type AppRole = "admin" | "manager" | "kitchen" | "delivery" | "counter" | "waiter";

const ROLE_SESSION_KEY = "staff_role_session";

function normalizeRole(raw: unknown): AppRole | null {
  if (typeof raw !== "string") return null;
  const r = raw.trim().toLowerCase();
  if (r === "admin") return "admin";
  if (r === "manager") return "manager";
  if (r === "kitchen" || r === "kitchen_staff") return "kitchen";
  if (r === "delivery" || r === "delivery_boy") return "delivery";
  if (r === "counter" || r === "cashier") return "counter";
  if (r === "waiter") return "waiter";
  return null;
}

export function routeForRole(role: AppRole | null): string {
  if (role === "admin" || role === "manager") return "/admin";
  if (role === "kitchen") return "/kitchen";
  if (role === "delivery") return "/delivery";
  if (role === "counter") return "/counter";
  if (role === "waiter") return "/waiter";
  return "/login";
}

type AuthContextValue = {
  user: User | null;
  role: AppRole | null;
  initializing: boolean;
  isAuthenticated: boolean;
  /** Set when env/config is invalid so UI can show a fix hint */
  firebaseConfigError: string | null;
  /** False until `getIdTokenResult()` finishes for the current user. */
  authClaimsResolved: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
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
        let nextRole: AppRole | null = null;

        if (userDocResult.status === "fulfilled" && userDocResult.value.exists()) {
          const data = userDocResult.value.data() as { role?: unknown };
          nextRole = normalizeRole(data.role);
        }

        if (!nextRole && tokenResult.status === "fulfilled") {
          if (process.env.NODE_ENV !== "production") {
            console.info("[auth] ID token claims:", tokenResult.value.claims);
          }
          nextRole = normalizeRole(tokenResult.value.claims.role);
        }

        setRole(nextRole);
        if (nextRole) {
          window.localStorage.setItem(ROLE_SESSION_KEY, nextRole);
        } else {
          window.localStorage.removeItem(ROLE_SESSION_KEY);
        }
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

  const login = useCallback(async (email: string, password: string) => {
    if (configErrorRef.current) {
      throw new Error(configErrorRef.current);
    }
    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      await cred.user.getIdToken(true);
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
