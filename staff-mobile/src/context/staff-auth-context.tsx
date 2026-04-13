import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { staffAuth } from "../lib/firebase";
import { staffDb } from "../lib/firebase";
import type { StaffFeature } from "../lib/rbac";
import { hasPermission } from "../lib/rbac";
import type { StaffRoleId } from "../constants/staff-roles";
import { login as staffLogin, logout as staffLogout } from "../services/auth.js";
import { clearStaffNotificationBadge } from "../services/notifications.js";
import {
  ensureStaffProfileDocument,
  isUsersProfileBlockingStaffApp,
  mergeNavigationRoleFromUsersDoc,
  parseStaffRoleFromUsersDocument,
  parseUsersDocApproved,
  resolveStaffSession,
  type PendingApprovalReason,
  type StaffProfile,
  type StaffSessionGate,
  USERS_COLLECTION
} from "../services/staffUsers";
import { STAFF_USERS_COLLECTION } from "../navigation/staff-role-routes";
import { logError, logWarn } from "../lib/error-logging";

export type { StaffProfile };
export type StaffGate = StaffSessionGate | "sync_error";

/** @deprecated Use {@link StaffGate} */
export type StaffGateStatus = StaffGate;

export type StaffUsersFirestoreSnapshot = {
  loaded: boolean;
  docExists: boolean;
  /** Normalized from `users/{uid}.role` */
  role: StaffRoleId | null;
  /** `null` = no doc or legacy row without explicit approval flags */
  approved: boolean | null;
  /** Firestore listener on `users/{uid}` failed */
  listenError: boolean;
};

type StaffAuthState = {
  user: User | null;
  staff: StaffProfile | null;
  role: StaffRoleId | null;
  loading: boolean;
  /** Routing: no "access denied" — paused = account inactive; sync_error = network/rules */
  gate: StaffGate;
  /** When `gate === "pending"`, which flow triggered it (for UI copy). */
  pendingApprovalReason: PendingApprovalReason | null;
  /** Latest `users/{uid}` fields used for RBAC / approval (real-time). */
  usersFirestore: StaffUsersFirestoreSnapshot | null;
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
  const [staffGate, setStaffGate] = useState<StaffGate>("loading");
  const [usersListenError, setUsersListenError] = useState(false);
  const [staffRealtimeBanner, setStaffRealtimeBanner] = useState<string | null>(null);

  const prevGateRef = useRef<StaffGate>("loading");
  /** Last merged {@link staff} role — detects `users/{uid}` (or `staff_users`) role changes for token refresh + UI. */
  const prevMergedRoleRef = useRef<string | null>(null);
  const ensureInFlightRef = useRef<Promise<void> | null>(null);

  const dismissStaffRealtimeBanner = useCallback(() => {
    setStaffRealtimeBanner(null);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(staffAuth, (next) => {
      setUser(next);
      setAuthReady(true);
      if (!next) {
        setStaffBase(null);
        setUsersDoc(undefined);
        setStaffSnapReady(false);
        setUsersSnapReady(false);
        setStaffGate("loading");
        setUsersListenError(false);
        prevGateRef.current = "loading";
        prevMergedRoleRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    const staffRef = doc(staffDb, STAFF_USERS_COLLECTION, uid);
    let cancelled = false;

    setStaffGate("loading");
    setStaffBase(null);
    setStaffSnapReady(false);
    ensureInFlightRef.current = null;

    const unsub = onSnapshot(
      staffRef,
      (snap) => {
        if (cancelled) return;
        setStaffSnapReady(true);

        const exists = snap.exists();

        if (!exists) {
          if (!ensureInFlightRef.current) {
            ensureInFlightRef.current = ensureStaffProfileDocument(uid, user.email)
              .catch((e) => {
                if (cancelled) return;
                logError("StaffAuth.ensureStaffProfileDocument", e);
                setStaffGate("sync_error");
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
          }
          setStaffBase(profile);
          setStaffGate("active");
          prevGateRef.current = "active";
          return;
        }

        setStaffBase(null);
        setStaffGate(g);
        prevGateRef.current = g;
      },
      (err) => {
        logWarn("StaffAuth.staff_users listener", err instanceof Error ? err.message : String(err), err);
        if (cancelled) return;
        setStaffBase(null);
        setStaffGate("sync_error");
        prevGateRef.current = "sync_error";
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  /**
   * Realtime `users/{uid}` — drives {@link usersDoc} (role override, approved flags).
   * Role updates merge into {@link staff} and trigger navigation reset + token refresh elsewhere.
   */
  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    const usersRef = doc(staffDb, USERS_COLLECTION, uid);
    let cancelled = false;

    setUsersDoc(undefined);
    setUsersSnapReady(false);
    setUsersListenError(false);

    const unsub = onSnapshot(
      usersRef,
      (snap) => {
        if (cancelled) return;
        setUsersSnapReady(true);
        setUsersListenError(false);
        setUsersDoc(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
      },
      (err) => {
        logWarn("StaffAuth.users listener", err instanceof Error ? err.message : String(err), err);
        if (cancelled) return;
        setUsersListenError(true);
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
    if (!staffBase || staffGate !== "active") return staffBase;
    return mergeNavigationRoleFromUsersDoc(staffBase, usersDoc);
  }, [staffBase, staffGate, usersDoc]);

  const effectiveGate: StaffGate = useMemo(() => {
    if (usersListenError) return "sync_error";
    if (
      staffGate === "active" &&
      usersSnapReady &&
      isUsersProfileBlockingStaffApp(usersDoc ?? undefined)
    ) {
      return "pending";
    }
    return staffGate;
  }, [staffGate, usersSnapReady, usersDoc, usersListenError]);

  const pendingApprovalReason = useMemo((): PendingApprovalReason | null => {
    if (effectiveGate !== "pending") return null;
    if (usersSnapReady && isUsersProfileBlockingStaffApp(usersDoc ?? undefined)) return "users_doc";
    return "staff_profile";
  }, [effectiveGate, usersSnapReady, usersDoc]);

  const usersFirestore = useMemo((): StaffUsersFirestoreSnapshot | null => {
    if (!user) return null;
    if (!usersSnapReady) {
      return {
        loaded: false,
        docExists: false,
        role: null,
        approved: null,
        listenError: usersListenError
      };
    }
    return {
      loaded: true,
      docExists: usersDoc != null,
      role: parseStaffRoleFromUsersDocument(usersDoc ?? undefined),
      approved: parseUsersDocApproved(usersDoc ?? undefined),
      listenError: usersListenError
    };
  }, [user, usersSnapReady, usersDoc, usersListenError]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      try {
        await staffLogout();
      } catch {
        /* noop */
      }
      const u = await staffLogin(email, password);
      if (!u.uid) throw new Error("No UID from Auth.");
    } catch (e) {
      logError("staff-auth.signInWithEmail", e);
      throw e;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await clearStaffNotificationBadge();
      await staffLogout();
    } catch (e) {
      logError("staff-auth.signOutUser", e);
      throw e;
    }
  }, []);

  /** Explicit `approved: false` on `users/{uid}` → sign out (security). */
  useEffect(() => {
    if (!user?.uid || !usersSnapReady) return;
    if (!usersDoc || typeof usersDoc !== "object") return;
    if (usersDoc.approved !== false) return;
    void signOutUser().catch(() => undefined);
  }, [user?.uid, usersSnapReady, usersDoc, signOutUser]);

  /**
   * When merged navigation role changes (usually from realtime `users/{uid}.role`), refresh custom claims
   * and nudge UI. Root stack remount is handled in AppNavigator via `key={routeKey}`.
   */
  useEffect(() => {
    if (!user?.uid || effectiveGate !== "active") {
      if (!user) prevMergedRoleRef.current = null;
      return;
    }
    const next = staff?.role ?? null;
    if (!next) return;
    const prev = prevMergedRoleRef.current;
    if (prev !== null && prev !== next) {
      setStaffRealtimeBanner(`Your role is now: ${next}`);
      void staffAuth.currentUser?.getIdToken(true).catch(() => undefined);
    }
    prevMergedRoleRef.current = next;
  }, [user?.uid, effectiveGate, staff?.role]);

  const hasFeature = useCallback(
    (feature: StaffFeature) => (staff ? hasPermission(staff.role, feature) : false),
    [staff]
  );

  /** Wait for Auth, `staff_users`, and `users/{uid}` first snapshot + gate resolution (RBAC). */
  const loading =
    !authReady ||
    (user !== null && (!staffSnapReady || !usersSnapReady || staffGate === "loading"));

  const value = useMemo(
    () => ({
      user,
      staff,
      role: (staff?.role ?? null) as StaffRoleId | null,
      loading,
      gate: effectiveGate,
      pendingApprovalReason,
      usersFirestore,
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
      effectiveGate,
      pendingApprovalReason,
      usersFirestore,
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
