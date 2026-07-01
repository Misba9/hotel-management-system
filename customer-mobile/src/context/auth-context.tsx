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
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/src/lib/firebase";
import { syncUserToFirestore } from "@/src/lib/sync-user-to-firestore";
import { clearSessionToken, saveSessionToken } from "@/src/lib/secure-storage";

export type AuthContextValue = {
  user: User | null;
  authReady: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const lastSyncedUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        lastSyncedUidRef.current = null;
        void clearSessionToken();
        return;
      }
      void (async () => {
        try {
          const token = await u.getIdToken();
          await saveSessionToken(token);
        } catch {
          /* ignore */
        }
      })();
      if (lastSyncedUidRef.current === u.uid) return;
      lastSyncedUidRef.current = u.uid;
      void syncUserToFirestore(u).catch(() => {
        /* best effort */
      });
    });

    const fallback = setTimeout(() => {
      setAuthReady((ready) => {
        if (ready) return ready;
        setUser(auth.currentUser);
        return true;
      });
    }, 2000);

    return () => {
      clearTimeout(fallback);
      unsub();
    };
  }, []);

  const logout = useCallback(async () => {
    await clearSessionToken();
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      authReady,
      isAuthenticated: Boolean(user),
      logout
    }),
    [user, authReady, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
