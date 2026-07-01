import { FirebaseError } from "firebase/app";
import {
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  getDoc
} from "firebase/firestore";

export async function safeGetDoc<T extends DocumentData>(
  ref: DocumentReference<T>,
  retries = 1
): Promise<DocumentSnapshot<T>> {
  try {
    return await getDoc(ref);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
    if ((code === "unavailable" || code === "failed-precondition") && retries > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      return safeGetDoc(ref, retries - 1);
    }
    throw error;
  }
}

export function isOfflineLikeFirestoreError(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    if (error.code === "unavailable" && /offline/i.test(error.message)) return true;
    if (/client is offline/i.test(error.message)) return true;
  }
  return false;
}
