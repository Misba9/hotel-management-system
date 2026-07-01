import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { mapUserProfileFromDoc, type FirestoreUserProfile } from "@/src/lib/user-service";
import { db } from "@/src/services/firebase";

export function useUserProfile(uid: string | null | undefined) {
  const [profile, setProfile] = useState<FirestoreUserProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile(mapUserProfileFromDoc(uid, snap.data() as Record<string, unknown>));
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsub;
  }, [uid]);

  return { profile, loading };
}
