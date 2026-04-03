import type { App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import { createLazyAdminService } from "./admin";

/**
 * Realtime Database (order feeds, delivery tracking, health ping).
 * Kept separate from `admin.ts`, which is Firestore-focused.
 */
export const adminRtdb: Database = createLazyAdminService<Database>("Realtime Database", (adminApp: App) =>
  getDatabase(adminApp)
);
