import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type Auth,
  type User
} from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc, type Firestore } from "firebase/firestore";
import { canAccessStaffPlatform } from "@shared/constants/staff-app-access";
import {
  resolveStaffAppRole,
  usersDocBlocksStaffAccess,
  type StaffAppRole
} from "@shared/utils/staff-access-control";
import {
  hasManagerOperationalAccess,
  isAdminRole
} from "@shared/utils/manager-permissions";
import { isDesktopRuntime, getDesktopApi } from "./desktop-api";

function trimEnv(raw: string | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  return raw.trim().replace(/^["']|["']$/g, "");
}

function env(name: string): string | undefined {
  return trimEnv(import.meta.env[name as keyof ImportMetaEnv] as string | undefined);
}

function readFirebaseConfigFromVite() {
  return {
    apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY") ?? env("VITE_FIREBASE_API_KEY"),
    authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") ?? env("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? env("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") ?? env("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId:
      env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") ?? env("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: env("NEXT_PUBLIC_FIREBASE_APP_ID") ?? env("VITE_FIREBASE_APP_ID")
  };
}

const FIREBASE_APP_NAME = "nausheen-staff-desktop";

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let ipcConfigLoaded = false;

async function ensureFirebaseConfigFromIpc(): Promise<void> {
  if (ipcConfigLoaded || !isDesktopRuntime()) return;
  const ipcConfig = await getDesktopApi().getFirebaseConfig();
  if (!ipcConfig.apiKey || !ipcConfig.projectId || !ipcConfig.appId) return;

  const hasViteConfig = Boolean(
    env("NEXT_PUBLIC_FIREBASE_API_KEY") ?? env("VITE_FIREBASE_API_KEY")
  );
  if (hasViteConfig) {
    ipcConfigLoaded = true;
    return;
  }

  (import.meta.env as Record<string, string>).NEXT_PUBLIC_FIREBASE_API_KEY = ipcConfig.apiKey;
  (import.meta.env as Record<string, string>).NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = ipcConfig.authDomain;
  (import.meta.env as Record<string, string>).NEXT_PUBLIC_FIREBASE_PROJECT_ID = ipcConfig.projectId;
  (import.meta.env as Record<string, string>).NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = ipcConfig.storageBucket;
  (import.meta.env as Record<string, string>).NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID =
    ipcConfig.messagingSenderId;
  (import.meta.env as Record<string, string>).NEXT_PUBLIC_FIREBASE_APP_ID = ipcConfig.appId;
  ipcConfigLoaded = true;
}

export async function getStaffDesktopFirebaseApp(): Promise<FirebaseApp | null> {
  await ensureFirebaseConfigFromIpc();
  const config = readFirebaseConfigFromVite();
  if (!config.apiKey || !config.projectId || !config.appId) {
    console.warn("[firebase] Missing Firebase config.");
    return null;
  }

  if (firebaseApp) return firebaseApp;

  try {
    firebaseApp = getApp(FIREBASE_APP_NAME);
  } catch {
    firebaseApp = initializeApp(config, FIREBASE_APP_NAME);
  }

  return firebaseApp;
}

export async function getStaffDesktopFirestore(): Promise<Firestore | null> {
  const app = await getStaffDesktopFirebaseApp();
  if (!app) return null;
  if (!firebaseDb) firebaseDb = getFirestore(app);
  return firebaseDb;
}

export async function getStaffDesktopAuth(): Promise<Auth | null> {
  const app = await getStaffDesktopFirebaseApp();
  if (!app) return null;
  if (!firebaseAuth) firebaseAuth = getAuth(app);
  return firebaseAuth;
}

export type StaffProfile = {
  uid: string;
  email: string;
  name: string;
  role: StaffAppRole;
};

function isOperationalDesktopRole(role: StaffAppRole): role is "manager" | "cashier" | "kitchen" {
  return hasManagerOperationalAccess(role) || role === "cashier" || role === "kitchen";
}

export async function resolveStaffProfile(user: User): Promise<StaffProfile | null> {
  const db = await getStaffDesktopFirestore();
  if (!db) return null;

  const staffSnap = await getDoc(doc(db, "staff_users", user.uid));
  const staffData = staffSnap.exists() ? staffSnap.data() : null;

  const usersSnap = await getDoc(doc(db, "users", user.uid));
  const usersData = usersSnap.exists() ? usersSnap.data() : null;

  if (usersDocBlocksStaffAccess(usersData)) {
    return null;
  }

  if (staffData?.isActive === false) {
    return null;
  }

  const token = await user.getIdTokenResult();
  const role = resolveStaffAppRole(staffData ?? usersData, token.claims.role);
  if (!role) return null;
  if (!isOperationalDesktopRole(role)) return null;

  const platformDoc = staffData ?? usersData;
  if (!canAccessStaffPlatform("desktop", platformDoc)) {
    return null;
  }

  const email = user.email ?? "";
  const name =
    (typeof staffData?.name === "string" && staffData.name.trim()) ||
    (typeof usersData?.displayName === "string" && usersData.displayName.trim()) ||
    (email.includes("@") ? email.split("@")[0] : "Staff");

  return { uid: user.uid, email, name, role };
}

export async function loginStaff(email: string, password: string): Promise<StaffProfile> {
  const auth = await getStaffDesktopAuth();
  if (!auth) throw new Error("Firebase is not configured.");

  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await cred.user.getIdToken(true);
  const profile = await resolveStaffProfile(cred.user);
  if (!profile) {
    await signOut(auth);
    const db = await getStaffDesktopFirestore();
    if (db) {
      const staffSnap = await getDoc(doc(db, "staff_users", cred.user.uid));
      const staffData = staffSnap.exists() ? staffSnap.data() : null;
      const usersSnap = await getDoc(doc(db, "users", cred.user.uid));
      const usersData = usersSnap.exists() ? usersSnap.data() : null;
      const platformDoc = staffData ?? usersData;
      const role = resolveStaffAppRole(staffData ?? usersData, (await cred.user.getIdTokenResult()).claims.role);
      if (isAdminRole(role)) {
        throw new Error("This account is intended for the Admin Web Panel.");
      }
      if (role === "waiter") {
        throw new Error("This account is intended for the Staff Mobile app.");
      }
      if (role && !isOperationalDesktopRole(role)) {
        throw new Error("Your role is not permitted on the Staff Desktop application.");
      }
      if (role && platformDoc && !canAccessStaffPlatform("desktop", platformDoc)) {
        throw new Error("Your role is not permitted on the desktop app. Use the mobile app or contact your manager.");
      }
    }
    throw new Error("Your account is not approved or has no operational role assigned.");
  }
  return profile;
}

export async function logoutStaff(): Promise<void> {
  const auth = await getStaffDesktopAuth();
  if (!auth) return;
  await signOut(auth);
}

export function subscribeAuthState(
  onChange: (user: User | null, profile: StaffProfile | null) => void
): () => void {
  let unsub = () => {};
  void (async () => {
    const auth = await getStaffDesktopAuth();
    if (!auth) {
      onChange(null, null);
      return;
    }
    unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        onChange(null, null);
        return;
      }
      void resolveStaffProfile(user)
        .then((profile) => onChange(user, profile))
        .catch(() => onChange(user, null));
    });
  })();
  return () => unsub();
}

export async function updateStaffDisplayName(nextName: string): Promise<void> {
  const auth = await getStaffDesktopAuth();
  const db = await getStaffDesktopFirestore();
  if (!auth || !db) throw new Error("Firebase is not configured.");
  const user = auth.currentUser;
  if (!user) throw new Error("Login required.");

  const name = nextName.trim();
  if (name.length < 2) {
    throw new Error("Display name must be at least 2 characters.");
  }

  const payload = { updatedAt: new Date().toISOString() };
  await Promise.all([
    setDoc(doc(db, "staff_users", user.uid), { ...payload, name }, { merge: true }),
    setDoc(doc(db, "users", user.uid), { ...payload, displayName: name }, { merge: true })
  ]);
}

export async function updateStaffPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const auth = await getStaffDesktopAuth();
  if (!auth) throw new Error("Firebase is not configured.");
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Login required.");

  const current = currentPassword.trim();
  const next = newPassword.trim();
  if (!current) throw new Error("Current password is required.");
  if (next.length < 8) throw new Error("New password must be at least 8 characters.");

  const credential = EmailAuthProvider.credential(user.email, current);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, next);
}
