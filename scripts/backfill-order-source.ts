/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldPath } = require("firebase-admin/firestore");

const repoRoot = path.join(__dirname, "..");
for (const rel of ["admin-dashboard/.env.local", ".env.local"]) {
  const p = path.join(repoRoot, rel);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: false });
  }
}

function loadCredential() {
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
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: loadCredential() });
}

function deriveOrderType(data: Record<string, unknown>): "dine_in" | "online" {
  const type = typeof data.orderType === "string" ? data.orderType.trim().toLowerCase() : "";
  if (type === "dine_in") return "dine_in";
  if (type === "online") return "online";
  if (type === "table" || type === "dine-in") return "dine_in";
  if (type === "delivery" || type === "pickup") return "online";

  const src = typeof data.orderSource === "string" ? data.orderSource.trim().toLowerCase() : "";
  if (src === "waiter") return "dine_in";
  if (src === "customer") return "online";

  if (typeof data.tableId === "string" && data.tableId.trim()) return "dine_in";
  if (typeof data.tableName === "string" && data.tableName.trim()) return "dine_in";
  if (typeof data.tableNumber === "number" && Number.isFinite(data.tableNumber)) return "dine_in";

  return "online";
}

async function run() {
  const db = getFirestore();
  const ordersRef = db.collection("orders");
  const snap = await ordersRef.get();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const docSnap of snap.docs) {
    scanned += 1;
    const data = docSnap.data() || {};
    const nextType = deriveOrderType(data);
    const currentType = typeof data.orderType === "string" ? data.orderType.trim().toLowerCase() : "";
    if (currentType === nextType) {
      skipped += 1;
      continue;
    }

    batch.update(docSnap.ref, {
      orderType: nextType,
      updatedAt: new Date().toISOString()
    });
    inBatch += 1;
    updated += 1;

    if (inBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }

  if (inBatch > 0) {
    await batch.commit();
  }

  console.log("Backfill complete.");
  console.log(`Scanned: ${scanned}`);
  console.log(`Updated (set orderType): ${updated}`);
  console.log(`Skipped (already valid): ${skipped}`);
}

run().catch((err: unknown) => {
  console.error("Backfill failed.");
  console.error(err);
  process.exit(1);
});

