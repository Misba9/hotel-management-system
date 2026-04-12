import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { staffAuth } from "../lib/firebase";
import { staffDb } from "../lib/firebase";
import { firebaseApp } from "../services/firebase";
import type { StaffFeature } from "../lib/rbac";
import { hasPermission } from "../lib/rbac";
import type { StaffRoleId } from "../constants/staff-roles";
import { login as staffLogin, logout as staffLogout } from "../services/auth.js";
import { clearStaffNotificationBadge } from "../services/notifications.js";
import {
  ensureStaffProfileDocument,
  mergeNavigationRoleFromUsersDoc,
  resolveStaffSession,
  type StaffProfile,
  type StaffSessionGate,
  USERS_COLLECTION
} from "../services/staffUsers";
import { STAFF_USERS_COLLECTION } from "../navigation/staff-role-routes";

export type { StaffProfile };
export type StaffGate = StaffSessionGate | "sync_error";

/** @deprecated Use {@link StaffGate} */
export type StaffGateStatus = StaffGate;

type StaffAuthState = {
  user: User | null;
  staff: StaffProfile | null;
  role: StaffRoleId | null;
  loading: boolean;
  /** Routing: no "access denied" — paused = account inactive; sync_error = network/rules */
  gate: StaffGate;
  staffRealtimeBanner: string | null;
  dismissStaffRealtimeBanner: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  hasFeature: (feature: StaffFeature) => boolean;
};

const StaffAuthContext = createContext<StaffAuthState | undefined>(undefined);

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  /** Profile derived from `staff_users/{uid}` (approval + default role). */
  const [staffBase, setStaffBase] = useState<StaffProfile | null>(null);
  /** `users/{uid}` snapshot: `undefined` = not loaded yet; `null` = no document. */
  const [usersDoc, setUsersDoc] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [staffSnapReady, setStaffSnapReady] = useState(false);
  const [usersSnapReady, setUsersSnapReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [gate, setGate] = useState<StaffGate>("loading");
  const [staffRealtimeBanner, setStaffRealtimeBanner] = useState<string | null>(null);

  const prevGateRef = useRef<StaffGate>("loading");
  const lastApprovedRoleRef = useRef<string | null>(null);
  const ensureInFlightRef = useRef<Promise<void> | null>(null);

  const dismissStaffRealtimeBanner = useCallback(() => {
    setStaffRealtimeBanner(null);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(staffAuth, (next) => {
      setUser(next);
      setAuthReady(true);
      if (next) {
        // eslint-disable-next-line no-console
        console.log("UID:", next.uid, "| project:", firebaseApp.options.projectId);
      } else {
        setStaffBase(null);
        setUsersDoc(undefined);
        setStaffSnapReady(false);
        setUsersSnapReady(false);
        setGate("loading");
        prevGateRef.current = "loading";
        lastApprovedRoleRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    const staffRef = doc(staffDb, STAFF_USERS_COLLECTION, uid);
    let cancelled = false;

    setGate("loading");
    setStaffBase(null);
    setStaffSnapReady(false);
    ensureInFlightRef.current = null;

    const unsub = onSnapshot(
      staffRef,
      (snap) => {
        if (cancelled) return;
        setStaffSnapReady(true);

        const exists = snap.exists();
        // eslint-disable-next-line no-console
        console.log("UID:", uid, "| staff_users exists:", exists);

        if (!exists) {
          if (!ensureInFlightRef.current) {
            ensureInFlightRef.current = ensureStaffProfileDocument(uid, user.email)
              .catch((e) => {
                if (cancelled) return;
                console.warn("[StaffAuth] ensure profile:", e);
                setGate("sync_error");
                setStaffBase(null);
              })
              .finally(() => {
                ensureInFlightRef.current = null;
              });
          }
          return;
        }

        const data = snap.data() as Record<string, unknown>;
        const { gate: g, profile } = resolveStaffSession(uid, user.email, data, true);
        const prev = prevGateRef.current;

        if (g === "active" && profile) {
          if (prev === "pending" || prev === "needs_assignment") {
            setStaffRealtimeBanner("You're approved. Welcome!");
            void staffAuth.currentUser?.getIdToken(true).catch(() => undefined);
          } else if (
            lastApprovedRoleRef.current !== null &&
            lastApprovedRoleRef.current !== profile.role
          ) {
            setStaffRealtimeBanner(`Your role is now: ${profile.role}`);
            void staffAuth.currentUser?.getIdToken(true).catch(() => undefined);
          }
          lastApprovedRoleRef.current = profile.role;
          setStaffBase(profile);
          setGate("active");
          prevGateRef.current = "active";
          return;
        }

        lastApprovedRoleRef.current = null;
        setStaffBase(null);
        setGate(g);
        prevGateRef.current = g;
      },
      (err) => {
        console.warn("[StaffAuth] Firestore listener:", err);
        if (cancelled) return;
        setStaffBase(null);
        setGate("sync_error");
        prevGateRef.current = "sync_error";
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  /** Canonical RBAC role: `users/{uid}.role` overrides `staff_users.role` when active. */
  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    const usersRef = doc(staffDb, USERS_COLLECTION, uid);
    let cancelled = false;

    setUsersDoc(undefined);
    setUsersSnapReady(false);

    const unsub = onSnapshot(
      usersRef,
      (snap) => {
        if (cancelled) return;
        setUsersSnapReady(true);
        setUsersDoc(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
      },
      (err) => {
        console.warn("[StaffAuth] users/{uid} listener:", err);
        if (cancelled) return;
        setUsersDoc(null);
        setUsersSnapReady(true);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  const staff = useMemo((): StaffProfile | null => {
    if (!staffBase || gate !== "active") return staffBase;
    return mergeNavigationRoleFromUsersDoc(staffBase, usersDoc);
  }, [staffBase, gate, usersDoc]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      await staffLogout();
    } catch {
      /* noop */
    }
    const u = await staffLogin(email, password);
    if (!u.uid) throw new Error("No UID from Auth.");
    // eslint-disable-next-line no-console
    console.log("UID:", u.uid);
  }, []);

  const signOutUser = useCallback(async () => {
    await clearStaffNotificationBadge();
    await staffLogout();
  }, []);

  const hasFeature = useCallback(
    (feature: StaffFeature) => (staff ? hasPermission(staff.role, feature) : false),
    [staff]
  );

  /** Wait for Auth, `staff_users`, and `users/{uid}` first snapshot + gate resolution (RBAC). */
  const loading =
    !authReady ||
    (user !== null && (!staffSnapReady || !usersSnapReady || gate === "loading"));

  const value = useMemo(
    () => ({
      user,
      staff,
      role: (staff?.role ?? null) as StaffRoleId | null,
      loading,
      gate,
      staffRealtimeBanner,
      dismissStaffRealtimeBanner,
      signInWithEmail,
      signOutUser,
      hasFeature
    }),
    [
      user,
      staff,
      loading,
      gate,
      staffRealtimeBanner,
      dismissStaffRealtimeBanner,
      signInWithEmail,
      signOutUser,
      hasFeature
    ]
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error("useStaffAuth must be used within StaffAuthProvider");
  return ctx;
}

export type { StaffFeature };
