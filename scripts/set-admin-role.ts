/**
 * Set Firebase Auth custom claim: `role: "admin"` (replaces all custom claims on the user).
 *
 * ## Credentials (pick one)
 *
 * 1. **`serviceAccountKey.json`** at the **repository root**, or
 * 2. **`FIREBASE_PROJECT_ID`**, **`FIREBASE_CLIENT_EMAIL`**, **`FIREBASE_PRIVATE_KEY`** in **`.env.local`**
 *    (repo root or `admin-dashboard/.env.local`).
 *
 * ## Run
 *
 * ```bash
 * npm run set-admin-role -- <USER_UID>
 * ```
 *
 * ```bash
 * npx ts-node --project scripts/tsconfig.json scripts/set-admin-role.ts <USER_UID>
 * ```
 *
 * ## After running
 *
 * Sign out and sign in again (or `getIdToken(true)`) so the ID token includes the claim.
 */
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const repoRoot = path.join(__dirname, "..");
for (const rel of ["admin-dashboard/.env.local", ".env.local"]) {
  const p = path.join(repoRoot, rel);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: false });
  }
}

function loadCredential(): ReturnType<typeof cert> {
  const jsonPath = path.join(repoRoot, "serviceAccountKey.json");
  if (fs.existsSync(jsonPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    return cert(serviceAccount);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  console.error("Error: no Firebase Admin credentials found.");
  console.error("Either:");
  console.error("  • Add serviceAccountKey.json at the repository root, or");
  console.error(
    "  • Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env.local (root or admin-dashboard/)."
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: loadCredential()
  });
}

function readUidFromArgv(): string {
  const a2 = (process.argv[2] ?? "").trim();
  const a3 = (process.argv[3] ?? "").trim();
  if (a2.endsWith(".ts") || a2.includes("set-admin-role")) {
    return a3;
  }
  return a2;
}

const uid = readUidFromArgv();

if (!uid) {
  console.error("Error: missing UID.");
  console.error("Usage: npm run set-admin-role -- <USER_UID>");
  console.error("   or: npx ts-node --project scripts/tsconfig.json scripts/set-admin-role.ts <USER_UID>");
  process.exit(1);
}

async function run(): Promise<void> {
  console.log("Setting admin role...");
  console.log(`  uid: ${uid}`);

  const auth = getAuth();
  await auth.setCustomUserClaims(uid, { role: "admin" });

  console.log('Success: custom claims set to { role: "admin" }. Sign out and sign in to refresh the ID token.');
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("Error: failed to set custom claims.");
    console.error(err);
    process.exit(1);
  });
