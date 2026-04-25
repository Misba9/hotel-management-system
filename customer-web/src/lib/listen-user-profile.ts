import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
      options.onError?.(error);
    }
  );
}
