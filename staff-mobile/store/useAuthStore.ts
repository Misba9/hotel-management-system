import { create } from "zustand";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";

import type { StaffRoleId } from "../src/constants/staff-roles";
import { staffAuth, staffDb } from "../src/lib/firebase";
import { STAFF_USERS_COLLECTION } from "../src/navigation/staff-role-routes";
import { login as firebaseEmailLogin, logout as firebaseLogout } from "../src/services/auth.js";
import {
  ensureStaffProfileDocument,
  resolveStaffSession,
  type StaffProfile
} from "../src/services/staffUsers";

type AuthState = {
  user: User | null;
  role: StaffRoleId | null;
  profile: StaffProfile | null;
  /** True until the first `onAuthStateChanged` callback has finished (success or failure). */
  loading: boolean;
  /** After first auth tick, UI may render routes (no infinite splash). */
  authReady: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null, role: StaffRoleId | null, displayName?: string | null) => void;
  setLoading: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => () => void;
};

let unsubRole: (() => void) | undefined;
let unsubAuthGlobal: (() => void) | undefined;

const HYDRATE_MS = 12_000;

async function hydrateStaffRole(user: User): Promise<{
  role: StaffRoleId | null;
  profile: StaffProfile | null;
}> {
  const run = async (): Promise<{ role: StaffRoleId | null; profile: StaffProfile | null }> => {
    const uid = user.uid;
    const ref = doc(staffDb, STAFF_USERS_COLLECTION, uid);
    let snap = await getDoc(ref);

    if (!snap.exists()) {
      try {
        await ensureStaffProfileDocument(uid, user.email);
      } catch {
        /* ignore */
      }
      snap = await getDoc(ref);
    }

    if (!snap.exists()) {
      return { role: null, profile: null };
    }

    const data = snap.data() as Record<string, unknown>;
    const { gate, profile } = resolveStaffSession(uid, user.email, data, true);
    if (gate === "active" && profile) {
      return { role: profile.role, profile };
    }
    return { role: null, profile: null };
  };

  try {
    return await Promise.race([
      run(),
      new Promise<{ role: StaffRoleId | null; profile: StaffProfile | null }>((_, rej) =>
        setTimeout(() => rej(new Error("staff profile timeout")), HYDRATE_MS)
      )
    ]);
  } catch {
    return { role: null, profile: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  profile: null,
  loading: true,
  authReady: false,
  isAuthenticated: false,

  setLoading: (v) => set({ loading: v }),

  setUser: (user, role, displayName) => {
    if (!user || role == null) {
      set({
        user: null,
        role: null,
        profile: null,
        isAuthenticated: false
      });
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
    set({ user, role, profile, isAuthenticated: true });
  },

  login: async (email: string, password: string) => {
    await firebaseEmailLogin(email, password);
    await staffAuth.currentUser?.getIdToken(true);
  },

  logout: async () => {
    unsubRole?.();
    unsubRole = undefined;
    set({
      user: null,
      role: null,
      profile: null,
      isAuthenticated: false
    });
    await firebaseLogout();
  },

  init: () => {
    unsubAuthGlobal?.();
    unsubAuthGlobal = undefined;
    unsubRole?.();
    unsubRole = undefined;

    unsubAuthGlobal = onAuthStateChanged(staffAuth, async (user) => {
      unsubRole?.();
      unsubRole = undefined;

      if (!user) {
        set({
          user: null,
          role: null,
          profile: null,
          isAuthenticated: false,
          loading: false,
          authReady: true
        });
        return;
      }

      set({ user, loading: true, authReady: false, isAuthenticated: false, role: null, profile: null });

      try {
        const { role, profile } = await hydrateStaffRole(user);
        if (role && profile) {
          set({ role, profile, user, isAuthenticated: true });
        } else {
          set({ role: null, profile: null, user, isAuthenticated: false });
        }
      } catch {
        set({ role: null, profile: null, isAuthenticated: false });
      } finally {
        set({ loading: false, authReady: true });
      }

      const staffRef = doc(staffDb, STAFF_USERS_COLLECTION, user.uid);
      unsubRole = onSnapshot(staffRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const { gate, profile } = resolveStaffSession(user.uid, user.email, data, true);
        if (gate === "active" && profile) {
          set({ role: profile.role, profile, isAuthenticated: true });
        } else {
          set({ role: null, profile: null, isAuthenticated: false });
        }
      });
    });

    return () => {
      unsubAuthGlobal?.();
      unsubAuthGlobal = undefined;
      unsubRole?.();
      unsubRole = undefined;
    };
  }
}));
