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
import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { db, isFirebaseClientConfigured } from "@/lib/firebase";
import {
  getUser,
  mapUserProfileFromDoc,
  type FirestoreUserProfile
} from "@/lib/user-service";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { withRetry } from "@shared/utils/retry";

type UserProfileContextValue = {
  profile: FirestoreUserProfile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

const SNAPSHOT_RETRY_MAX = 3;
const SNAPSHOT_RETRY_MS = 2000;

function fallbackProfileFromAuth(u: User): FirestoreUserProfile {
  return {
    uid: u.uid,
    name: u.displayName?.trim() || "",
    email: u.email || "",
    phone: u.phoneNumber?.trim() || ""
  };
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth();
  const online = useOnlineStatus();
  const [profile, setProfile] = useState<FirestoreUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapshotRetryRef = useRef(0);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setError(null);
      return;
    }
    if (!isFirebaseClientConfigured()) return;
    try {
      const p = await withRetry(() => getUser(user.uid), { maxAttempts: 3, baseDelayMs: 400 });
      if (p) {
        setProfile(p);
        setError(null);
      } else {
        setProfile(fallbackProfileFromAuth(user));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load profile.";
      setError(msg);
      console.error("[user-profile] refreshProfile", e);
    }
  }, [user]);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setProfile(null);
      setError(null);
      setLoading(false);
      snapshotRetryRef.current = 0;
      return;
    }

    if (!isFirebaseClientConfigured()) {
      setProfile(fallbackProfileFromAuth(user));
      setLoading(false);
      setError("Firebase is not configured.");
      return;
    }

    /** Offline: keep last snapshot; if none yet, show auth-derived fields (no Firestore call). */
    if (!online) {
      setLoading(false);
      setProfile((prev) => prev ?? fallbackProfileFromAuth(user));
      return;
    }

    setLoading(true);
    setError(null);
    snapshotRetryRef.current = 0;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;

    const userRef = doc(db, "users", user.uid);

    const attach = () => {
      unsubscribe?.();
      unsubscribe = onSnapshot(
        userRef,
        (snap) => {
          if (cancelled) return;
          snapshotRetryRef.current = 0;
          if (snap.exists()) {
            setProfile(mapUserProfileFromDoc(user.uid, snap.data() as Record<string, unknown>));
          } else {
            setProfile(fallbackProfileFromAuth(user));
          }
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("[user-profile]", err);
          if (cancelled) return;
          setLoading(false);
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          snapshotRetryRef.current += 1;
          if (snapshotRetryRef.current < SNAPSHOT_RETRY_MAX) {
            retryTimer = setTimeout(() => {
              if (cancelled) return;
              setLoading(true);
              attach();
            }, SNAPSHOT_RETRY_MS);
          }
        }
      );
    };

    attach();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribe?.();
      unsubscribe = null;
    };
  }, [user, authReady, online]);

  const value = useMemo<UserProfileContextValue>(
    () => ({
      profile,
      loading,
      error,
      refreshProfile
    }),
    [profile, loading, error, refreshProfile]
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile(): UserProfileContextValue {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    throw new Error("useUserProfile must be used within UserProfileProvider");
  }
  return ctx;
}
