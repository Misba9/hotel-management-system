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
import { useAuth } from "@/context/auth-context";
import type { FirestoreUserProfile } from "@/lib/user-service";
import { loadUserProfileForSession } from "@/lib/user-service";

type UserProfileContextValue = {
  profile: FirestoreUserProfile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth();
  const [profile, setProfile] = useState<FirestoreUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const lastLoadedUidRef = useRef<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const u = user;
    if (!u) {
      setProfile(null);
      setError(null);
      lastLoadedUidRef.current = null;
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const p = await loadUserProfileForSession(u);
      setProfile(p);
      lastLoadedUidRef.current = u.uid;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load profile.";
      setError(msg);
      setProfile(null);
      console.error("[user-profile]", e);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProfile(null);
      setError(null);
      setLoading(false);
      lastLoadedUidRef.current = null;
      return;
    }
    if (lastLoadedUidRef.current === user.uid) return;
    void refreshProfile();
  }, [user, authReady, refreshProfile]);

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
