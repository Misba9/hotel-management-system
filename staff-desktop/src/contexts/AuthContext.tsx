import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  loginStaff,
  logoutStaff,
  subscribeAuthState,
  type StaffProfile
} from "@/lib/firebase";
import type { StaffAppRole } from "@shared/utils/staff-access-control";

type AuthContextValue = {
  profile: StaffProfile | null;
  role: StaffAppRole | null;
  loading: boolean;
  authReady: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<StaffProfile>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthState((_user, nextProfile) => {
      setProfile(nextProfile);
      setLoading(false);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const nextProfile = await loginStaff(email, password);
      setProfile(nextProfile);
      return nextProfile;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed.";
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
      setAuthReady(true);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await logoutStaff();
      setProfile(null);
      setAuthError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      role: profile?.role ?? null,
      loading,
      authReady,
      authError,
      login,
      logout
    }),
    [profile, loading, authReady, authError, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
