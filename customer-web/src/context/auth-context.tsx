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
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AuthLoginModal } from "@/components/auth/auth-login-modal";
import { syncUserToFirestore } from "@/lib/sync-user-to-firestore";

export type OpenAuthModalOptions = {
  fullPageLoginHref?: string;
  modalTitle?: string;
  modalDescription?: string;
};

export type AuthContextValue = {
  /** Current Firebase user, or null if signed out. */
  user: User | null;
  /** True after the first `onAuthStateChanged` callback runs. */
  authReady: boolean;
  authModalOpen: boolean;
  /** True when `user` is non-null (session restored or just signed in). */
  isAuthenticated: boolean;
  /** Opens the sign-in modal (phone / email / Google / Apple). */
  login: (options?: OpenAuthModalOptions) => void;
  /** Signs out and closes the login modal. */
  logout: () => Promise<void>;
  closeAuthModal: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [modalFullPageLoginHref, setModalFullPageLoginHref] = useState("/login");
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalDescription, setModalDescription] = useState<string | undefined>(undefined);
  const lastSyncedUidRef = useRef<string | null>(null);

  useEffect(() => {
    void setPersistence(auth, browserLocalPersistence).catch(() => {
      /* ignore — e.g. SSR or unsupported */
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        lastSyncedUidRef.current = null;
        return;
      }
      if (lastSyncedUidRef.current === u.uid) return;
      lastSyncedUidRef.current = u.uid;
      void (async () => {
        try {
          await syncUserToFirestore(u);
        } catch (err) {
          console.log("skip sync (offline or transient)", err);
        }
      })();
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) setAuthModalOpen(false);
  }, [user]);

  useEffect(() => {
    if (!authModalOpen) {
      setModalFullPageLoginHref("/login");
      setModalTitle(undefined);
      setModalDescription(undefined);
    }
  }, [authModalOpen]);

  const login = useCallback((options?: OpenAuthModalOptions) => {
    setModalFullPageLoginHref(options?.fullPageLoginHref ?? "/login");
    setModalTitle(options?.modalTitle);
    setModalDescription(options?.modalDescription);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const logout = useCallback(async () => {
    setAuthModalOpen(false);
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      authReady,
      authModalOpen,
      isAuthenticated: Boolean(user),
      login,
      logout,
      closeAuthModal
    }),
    [user, authReady, authModalOpen, login, logout, closeAuthModal]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthLoginModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        fullPageLoginHref={modalFullPageLoginHref}
        title={modalTitle}
        description={modalDescription}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
