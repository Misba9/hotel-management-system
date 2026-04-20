import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";

export const dynamic = "force-dynamic";

type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string | null;
  /** Length of `addresses` on `customers/{id}`. */
  addressCount: number;
};

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_customers_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const snap = await adminDb.collection("customers").orderBy("createdAt", "desc").limit(400).get();
    const items: CustomerListItem[] = snap.docs.map((d) => {
      const row = d.data() as Record<string, unknown>;
      const addresses = Array.isArray(row.addresses) ? row.addresses : [];
      return {
        id: d.id,
        name: String(row.name ?? ""),
        phone: String(row.phone ?? ""),
        email: String(row.email ?? ""),
        createdAt: toIso(row.createdAt),
        addressCount: addresses.length
      };
    });
    return Response.json({ items }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/customers] GET failed", error);
    }
    return Response.json({ error: "Failed to fetch customers." }, { status: 500 });
  }
}
