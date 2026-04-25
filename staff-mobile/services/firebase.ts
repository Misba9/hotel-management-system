/**
 * Staff mobile Firebase entrypoints (same instances as `src/services/firebase` + `src/lib/firebase`).
 * Firestore staff directory: `staff_users/{uid}` (product / UI alias: **staffUsers**).
 */
export { firebaseApp, firestoreDb } from "../src/services/firebase";
export { staffAuth, staffDb } from "../src/lib/firebase";
