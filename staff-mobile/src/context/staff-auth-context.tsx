import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { staffAuth } from "../lib/firebase";

export type StaffRole =
  | "customer"
  | "kitchen_staff"
  | "waiter"
  | "cashier"
  | "delivery_boy"
  | "manager"
  | "admin";

type StaffAuthState = {
  user: User | null;
  role: StaffRole | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const StaffAuthContext = createContext<StaffAuthState | undefined>(undefined);

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(staffAuth, async (next) => {
      setUser(next);
      if (next) {
        const token = await next.getIdTokenResult(true);
        const claimRole = token.claims.role;
        setRole(typeof claimRole === "string" ? (claimRole as StaffRole) : "customer");
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(staffAuth, email.trim(), password);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(staffAuth);
  }, []);

  const value = useMemo(
    () => ({ user, role, loading, signInWithEmail, signOutUser }),
    [user, role, loading, signInWithEmail, signOutUser]
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) {
    throw new Error("useStaffAuth must be used within StaffAuthProvider");
  }
  return ctx;
}
