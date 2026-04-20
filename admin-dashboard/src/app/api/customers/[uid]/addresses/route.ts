import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";

export const dynamic = "force-dynamic";

export type AdminCustomerAddressRow = {
  id: string;
  label: string;
  name: string;
  phone: string;
  addressLine: string;
  landmark: string;
  city: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string | null;
  lat?: number;
  lng?: number;
};

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

function fromCustomersArray(
  raw: unknown
): Pick<
  AdminCustomerAddressRow,
  "id" | "label" | "addressLine" | "city" | "lat" | "lng"
>[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const o = entry as Record<string, unknown>;
      const id = String(o.id ?? "").trim();
      if (!id) return null;
      const label = String(o.label ?? "Home");
      const addressLine = String(o.addressLine ?? "");
      const city = String(o.city ?? "");
      const lat = typeof o.lat === "number" && Number.isFinite(o.lat) ? o.lat : undefined;
      const lng = typeof o.lng === "number" && Number.isFinite(o.lng) ? o.lng : undefined;
      return { id, label, addressLine, city, lat, lng };
    })
    .filter(Boolean) as Pick<
    AdminCustomerAddressRow,
    "id" | "label" | "addressLine" | "city" | "lat" | "lng"
  >[];
}

export async function GET(request: Request, context: { params: { uid: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_customer_addresses_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  const { uid } = context.params;
  if (!uid?.trim()) {
    return Response.json({ error: "Missing user id." }, { status: 400 });
  }

  try {
    const customerSnap = await adminDb.collection("customers").doc(uid).get();
    const items: AdminCustomerAddressRow[] = [];

    if (customerSnap.exists) {
      const crow = customerSnap.data() as Record<string, unknown>;
      const name = String(crow.name ?? "");
      const phone = String(crow.phone ?? "");
      const fromArr = fromCustomersArray(crow.addresses);
      for (const a of fromArr) {
        items.push({
          id: a.id,
          label: a.label,
          name,
          phone,
          addressLine: a.addressLine,
          landmark: "",
          city: a.city,
          pincode: "",
          isDefault: false,
          createdAt: null,
          lat: a.lat,
          lng: a.lng
        });
      }
    }

    if (items.length === 0) {
      const snap = await adminDb.collection("users").doc(uid).collection("addresses").limit(100).get();
      for (const d of snap.docs) {
        const row = d.data() as Record<string, unknown>;
        items.push({
          id: d.id,
          label: String(row.label ?? "Home"),
          name: String(row.name ?? ""),
          phone: String(row.phone ?? ""),
          addressLine: String(row.addressLine ?? row.street ?? row.address ?? ""),
          landmark: String(row.landmark ?? row.state ?? ""),
          city: String(row.city ?? ""),
          pincode: String(row.pincode ?? ""),
          isDefault: Boolean(row.isDefault),
          createdAt: toIso(row.createdAt)
        });
      }
    }

    if (items.length === 0) {
      const primary = await adminDb.collection("users").doc(uid).collection("address").doc("default").get();
      if (primary.exists) {
        const row = primary.data() as Record<string, unknown>;
        items.push({
          id: String(row.sourceAddressId ?? row.id ?? "default"),
          label: String(row.label ?? "Home"),
          name: String(row.name ?? ""),
          phone: String(row.phone ?? ""),
          addressLine: String(row.addressLine ?? row.street ?? row.address ?? ""),
          landmark: String(row.landmark ?? row.state ?? ""),
          city: String(row.city ?? ""),
          pincode: String(row.pincode ?? ""),
          isDefault: true,
          createdAt: toIso(row.createdAt)
        });
      }
    }

    items.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    return Response.json({ items }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/customers/[uid]/addresses] GET failed", error);
    }
    return Response.json({ error: "Failed to fetch addresses." }, { status: 500 });
  }
}
