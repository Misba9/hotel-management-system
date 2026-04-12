/**
 * Must match `google-services.json` → `project_info.project_id`.
 * If you change the Android Firebase project, update this AND `google-services.json`, then align `staff-mobile/.env`.
 * When this does not match `firebaseApp.options.projectId`, the app logs a clear error (Firestore reads the wrong project → exists: false).
 */
export const EXPECTED_NATIVE_PROJECT_ID = "nausheen-fruits-new";
