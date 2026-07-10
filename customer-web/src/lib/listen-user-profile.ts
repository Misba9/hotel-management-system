import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, ensureFirestoreOnline, logFirebaseDiagnostics } from "@/lib/firebase";
import { mapUserProfileFromDoc, type FirestoreUserProfile } from "@/lib/user-service";

type ListenUserProfileOptions = {
  onData: (profile: FirestoreUserProfile | null) => void;
  onError?: (error: unknown) => void;
};

/**
 * Real-time listener for `users/{uid}` profile doc.
 * Returns Firestore unsubscribe function for caller cleanup.
 */
export function listenUserProfile(uid: string, options: ListenUserProfileOptions): Unsubscribe {
  void ensureFirestoreOnline();
  return onSnapshot(
    doc(db, "users", uid),
    (docSnap) => {
      if (!docSnap.exists()) {
        options.onData(null);
        return;
      }
      options.onData(mapUserProfileFromDoc(uid, docSnap.data() as Record<string, unknown>));
    },
    (error) => {
      logFirebaseDiagnostics("listenUserProfile error", {
        uid,
        code:
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: string }).code)
            : "(none)",
        message: error instanceof Error ? error.message : String(error)
      });
      options.onError?.(error);
    }
  );
}
