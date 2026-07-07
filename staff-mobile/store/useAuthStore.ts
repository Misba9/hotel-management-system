import { create } from "zustand";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";

import type { StaffRoleId } from "../src/constants/staff-roles";
import { staffAuth, staffDb } from "../src/lib/firebase";
import { isExpectedAuthError } from "../components/Login/auth-messages";
import { logFirestoreOperationError } from "../src/lib/firestore-listener";
import { subscribeFirestoreDocument } from "../src/lib/firestore-listener";
import { assertValidUid } from "../src/lib/firestore-path";
import { STAFF_USERS_COLLECTION } from "../src/navigation/staff-role-routes";
import { login as firebaseEmailLogin, logout as firebaseLogout } from "../src/services/auth.js";
import { resolveStaffSession, type StaffProfile } from "../src/services/staffUsers";

type AuthState = {
  user: User | null;
  role: StaffRoleId | null;
  profile: StaffProfile | null;
  /** True while auth + staff profile hydration is in progress. */
  loading: boolean;
  /** After first auth tick, UI may render routes (no infinite splash). */
  authReady: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  setUser: (user: User | null, role: StaffRoleId | null, displayName?: string | null) => void;
  setLoading: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => () => void;
};

let unsubRole: (() => void) | undefined;
let unsubAuthGlobal: (() => void) | undefined;
let authListenerAttached = false;
let attachedRoleUid: string | null = null;
let sessionHydratedUid: string | null = null;
let authHydrationGen = 0;

const HYDRATE_MS = 12_000;
const AUTH_INIT_MS = 8_000;

function clearRoleListener() {
  attachedRoleUid = null;
  unsubRole?.();
  unsubRole = undefined;
}

function resetAuthState(set: (partial: Partial<AuthState>) => void) {
  sessionHydratedUid = null;
  clearRoleListener();
  set({
    user: null,
    role: null,
    profile: null,
    isAuthenticated: false,
    loading: false,
    authReady: true,
    authError: null
  });
}

function logAuthStoreError(scope: string, error: unknown) {
  if (isExpectedAuthError(error)) return;
  logFirestoreOperationError(scope, error);
}

async function hydrateStaffRole(user: User): Promise<{
  role: StaffRoleId | null;
  profile: StaffProfile | null;
  error: string | null;
}> {
  if (!user?.uid?.trim()) {
    return { role: null, profile: null, error: "Invalid user id." };
  }

  const run = async (): Promise<{
    role: StaffRoleId | null;
    profile: StaffProfile | null;
    error: string | null;
  }> => {
    const uid = assertValidUid(user.uid);
    const ref = doc(staffDb, STAFF_USERS_COLLECTION, uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return {
        role: null,
        profile: null,
        error: "Profile not found. Contact your administrator."
      };
    }

    const data = snap.data();
    if (!data || typeof data !== "object") {
      return { role: null, profile: null, error: "Staff profile data is empty." };
    }

    const { gate, profile } = resolveStaffSession(uid, user.email, data as Record<string, unknown>, true);
    if (gate === "active" && profile) {
      return { role: profile.role, profile, error: null };
    }
    if (gate === "pending") {
      return { role: null, profile: null, error: "Your account is pending approval or role assignment." };
    }
    if (gate === "needs_assignment") {
      return { role: null, profile: null, error: "Your role is not assigned yet. Contact an administrator." };
    }
    if (gate === "paused") {
      return { role: null, profile: null, error: "This staff account is inactive." };
    }
    if (gate === "platform_blocked") {
      return {
        role: null,
        profile: null,
        error: "Your role is not permitted on the mobile app. Use the desktop app or contact an administrator."
      };
    }
    return { role: null, profile: null, error: "Unable to activate staff session from Firestore." };
  };

  try {
    return await Promise.race([
      run(),
      new Promise<{ role: StaffRoleId | null; profile: StaffProfile | null; error: string | null }>(
        (_, rej) => setTimeout(() => rej(new Error("Staff profile load timed out.")), HYDRATE_MS)
      )
    ]);
  } catch (e) {
    logAuthStoreError("useAuthStore.hydrateStaffRole", e);
    return {
      role: null,
      profile: null,
      error: e instanceof Error ? e.message : "Failed to load staff profile."
    };
  }
}

function applyAuthenticatedSession(
  user: User,
  role: StaffRoleId,
  profile: StaffProfile,
  set: (partial: Partial<AuthState>) => void
) {
  const uid = assertValidUid(user.uid);
  sessionHydratedUid = uid;
  set({
    user,
    role,
    profile,
    isAuthenticated: true,
    authError: null,
    loading: false,
    authReady: true
  });
  attachStaffRoleListener(uid, user, set);
}

function attachStaffRoleListener(uid: string, user: User, set: (partial: Partial<AuthState>) => void) {
  const safeUid = assertValidUid(uid);
  if (attachedRoleUid === safeUid && unsubRole) return;

  clearRoleListener();
  attachedRoleUid = safeUid;
  const staffRef = doc(staffDb, STAFF_USERS_COLLECTION, safeUid);
  unsubRole =
    subscribeFirestoreDocument("useAuthStore.staff_users", staffRef, (snap) => {
      if (staffAuth.currentUser?.uid !== safeUid) return;
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data) return;
      const { gate, profile } = resolveStaffSession(safeUid, user.email, data as Record<string, unknown>, true);
      const current = useAuthStore.getState();
      if (gate === "active" && profile) {
        sessionHydratedUid = safeUid;
        if (
          current.isAuthenticated &&
          current.role === profile.role &&
          current.profile?.uid === profile.uid &&
          current.profile?.name === profile.name
        ) {
          return;
        }
        set({ role: profile.role, profile, isAuthenticated: true, authError: null, loading: false, authReady: true });
      } else {
        sessionHydratedUid = null;
        if (!current.isAuthenticated && !current.role && !current.profile) return;
        set({
          role: null,
          profile: null,
          isAuthenticated: false,
          loading: false,
          authReady: true
        });
      }
    }) ?? undefined;
}

function refreshStaffSessionInBackground(
  uid: string,
  user: User,
  hydrationId: number,
  set: (partial: Partial<AuthState>) => void
) {
  void (async () => {
    try {
      const { role, profile, error } = await hydrateStaffRole(user);
      if (hydrationId !== authHydrationGen) return;
      if (staffAuth.currentUser?.uid !== uid) return;

      if (role && profile) {
        applyAuthenticatedSession(user, role, profile, set);
      } else {
        sessionHydratedUid = null;
        set({
          user,
          role: null,
          profile: null,
          isAuthenticated: false,
          authError: error,
          loading: false,
          authReady: true
        });
      }
    } catch (e) {
      if (hydrationId !== authHydrationGen) return;
      logAuthStoreError("useAuthStore.refreshStaffSessionInBackground", e);
      sessionHydratedUid = null;
      set({
        user,
        role: null,
        profile: null,
        isAuthenticated: false,
        authError: e instanceof Error ? e.message : "Failed to load staff profile.",
        loading: false,
        authReady: true
      });
    }
  })();
}

/** Wait until auth store finishes hydration (used after `login()` resolves). */
export function waitForAuthHydration(timeoutMs = HYDRATE_MS): Promise<{ ok: true } | { ok: false; reason: string }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = () => {
      const s = useAuthStore.getState();
      if (s.authReady && !s.loading) {
        if (s.isAuthenticated && s.role) return resolve({ ok: true });
        return resolve({ ok: false, reason: s.authError ?? "Could not load staff profile." });
      }
      if (Date.now() - started > timeoutMs) {
        return resolve({ ok: false, reason: "Sign-in timed out. Check your connection and try again." });
      }
      setTimeout(poll, 50);
    };
    poll();
  });
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  profile: null,
  loading: true,
  authReady: false,
  isAuthenticated: false,
  authError: null,

  setLoading: (v) => set({ loading: v }),

  setUser: (user, role, displayName) => {
    if (!user || role == null) {
      resetAuthState(set);
      return;
    }
    const email = user.email ?? "";
    const name =
      (typeof displayName === "string" && displayName.trim()) ||
      (email.includes("@") ? email.split("@")[0] : "Staff");
    const profile: StaffProfile = {
      uid: user.uid,
      email,
      name,
      phoneNumber: user.phoneNumber ?? "",
      role
    };
    sessionHydratedUid = user.uid;
    set({ user, role, profile, isAuthenticated: true, authError: null });
  },

  login: async (email, password) => {
    const hydrationId = ++authHydrationGen;
    clearRoleListener();
    sessionHydratedUid = null;
    set({
      loading: true,
      authReady: false,
      authError: null,
      isAuthenticated: false,
      role: null,
      profile: null,
      user: null
    });

    try {
      const user = await firebaseEmailLogin(email, password);
      if (hydrationId !== authHydrationGen) return;
      if (!user?.uid?.trim()) {
        throw new Error("Sign-in succeeded but user id is missing.");
      }

      const { role, profile, error } = await hydrateStaffRole(user);
      if (hydrationId !== authHydrationGen) return;
      if (staffAuth.currentUser?.uid !== user.uid) return;

      if (!role || !profile) {
        try {
          await firebaseLogout();
        } catch (e) {
          logAuthStoreError("useAuthStore.login.logoutAfterProfileFail", e);
        }
        sessionHydratedUid = null;
        set({
          user: null,
          role: null,
          profile: null,
          isAuthenticated: false,
          loading: false,
          authReady: true,
          authError: error ?? "Profile not found."
        });
        throw new Error(error ?? "Profile not found.");
      }

      applyAuthenticatedSession(user, role, profile, set);
    } catch (e) {
      if (hydrationId !== authHydrationGen) throw e;
      if (!useAuthStore.getState().isAuthenticated) {
        set({
          user: null,
          role: null,
          profile: null,
          isAuthenticated: false,
          loading: false,
          authReady: true,
          authError: e instanceof Error ? e.message : "Login failed."
        });
      }
      logAuthStoreError("useAuthStore.login", e);
      throw e;
    }
  },

  logout: async () => {
    authHydrationGen += 1;
    sessionHydratedUid = null;
    clearRoleListener();
    set({
      user: null,
      role: null,
      profile: null,
      isAuthenticated: false,
      authError: null
    });
    try {
      await firebaseLogout();
    } catch (e) {
      logAuthStoreError("useAuthStore.logout", e);
      throw e;
    } finally {
      set({ loading: false, authReady: true });
    }
  },

  init: () => {
    if (authListenerAttached) {
      return () => {};
    }
    authListenerAttached = true;

    const authInitTimer = setTimeout(() => {
      const s = useAuthStore.getState();
      if (!s.authReady) {
        set({ loading: false, authReady: true });
      }
    }, AUTH_INIT_MS);

    unsubAuthGlobal = onAuthStateChanged(staffAuth, (user) => {
      clearTimeout(authInitTimer);

      if (!user?.uid?.trim()) {
        authHydrationGen += 1;
        resetAuthState(set);
        return;
      }

      const uid = user.uid.trim();
      const current = useAuthStore.getState();

      /** Same Firebase user — keep UI responsive; refresh profile in the background if needed. */
      if (sessionHydratedUid === uid) {
        set({ user, loading: false, authReady: true });
        attachStaffRoleListener(uid, user, set);
        if (current.isAuthenticated && current.role && current.profile) {
          return;
        }
        const hydrationId = ++authHydrationGen;
        refreshStaffSessionInBackground(uid, user, hydrationId, set);
        return;
      }

      const hydrationId = ++authHydrationGen;
      clearRoleListener();
      set({
        user,
        loading: true,
        authReady: false,
        isAuthenticated: false,
        role: null,
        profile: null,
        authError: null
      });

      refreshStaffSessionInBackground(uid, user, hydrationId, set);
    });

    return () => {
      clearTimeout(authInitTimer);
    };
  }
}));
