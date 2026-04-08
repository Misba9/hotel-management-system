/**
 * Insert dummy SaaS-shaped documents into Firestore `orders` for local dashboard testing.
 *
 * Usage (from repo root):
 *   npm run seed:dummy-orders
 *
 *
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * (e.g. in .env.local or admin-dashboard/.env.local).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const cwd = process.cwd();
for (const rel of [join("admin-dashboard", ".env.local"), ".env.local"]) {
  const p = join(cwd, rel);
  if (existsSync(p)) dotenv.config({ path: p, override: true });
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY. Add them to .env.local (repo root or admin-dashboard)."
  );
  process.exit(1);
}

const app =
  getApps().length > 0 ? getApp() : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const db = getFirestore(app);

const now = Timestamp.now();

const drafts = [
  {
    customerName: "Aisha Khan",
    phone: "+919876543210",
    items: [
      { name: "Mango Lassi", price: 80, qty: 2 },
      { name: "Masala Chaas", price: 40, qty: 1 }
    ],
    status: "pending"
  },
  {
    customerName: "Rahul Verma",
    phone: "+919811122233",
    items: [{ name: "Cold Coffee", price: 120, qty: 1 }],
    status: "delivered"
  },
  {
    customerName: "Priya Nair",
    phone: "+918877665544",
    items: [
      { name: "Orange Juice", price: 90, qty: 2 },
      { name: "Sandwich", price: 150, qty: 1 }
    ],
    status: "pending"
  },
  {
    customerName: "Vikram Singh",
    phone: "+916612345678",
    items: [{ name: "Watermelon Juice", price: 100, qty: 3 }],
    status: "delivered"
  },
  {
    customerName: "Neha Gupta",
    phone: "+919955004433",
    items: [
      { name: "Pomegranate Juice", price: 130, qty: 1 },
      { name: "Fruit Bowl", price: 200, qty: 1 }
    ],
    status: "delivered"
  },
  {
    customerName: "Arjun Mehta",
    phone: "+919933221100",
    items: [{ name: "Sweet Lime", price: 70, qty: 2 }],
    status: "pending"
  },
  {
    customerName: "Sneha Roy",
    phone: "+919900112233",
    items: [
      { name: "Apple Juice", price: 110, qty: 1 },
      { name: "Ginger Shot", price: 50, qty: 2 }
    ],
    status: "delivered"
  },
  {
    customerName: "Kabir Joshi",
    phone: "+919988776655",
    items: [{ name: "Mixed Fruit Punch", price: 160, qty: 1 }],
    status: "pending"
  }
];

function lineTotal(items) {
  return items.reduce((sum, row) => sum + Number(row.price) * Number(row.qty), 0);
}

const batch = db.batch();
let count = 0;

for (const d of drafts) {
  const ref = db.collection("orders").doc();
  const totalAmount = Math.round(lineTotal(d.items) * 100) / 100;
  batch.set(ref, {
    id: ref.id,
    customerName: d.customerName,
    phone: d.phone,
    items: d.items,
    totalAmount,
    status: d.status,
    createdAt: now
  });
  count += 1;
}

await batch.commit();

const pending = drafts.filter((x) => x.status === "pending").length;
const delivered = drafts.filter((x) => x.status === "delivered").length;

console.log(
  `Seeded ${count} orders: ${pending} pending, ${delivered} delivered. createdAt=${now.toDate().toISOString()}`
);
