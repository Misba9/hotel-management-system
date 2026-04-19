import { Timestamp } from "firebase/firestore";
import type { DeliveryAddress, SavedAddressLabel } from "@/lib/delivery-address-types";

function parseLabel(raw: unknown): SavedAddressLabel {
  const s = String(raw ?? "Home").trim();
  if (s === "Work" || s === "Other") return s;
  return "Home";
}

function tsToIso(v: unknown): string | undefined {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string" && v) return v;
  return undefined;
}

/** Maps one embedded map from `users/{uid}.addresses[]` to `DeliveryAddress`. */
export function embeddedMapToDelivery(uid: string, raw: Record<string, unknown>): DeliveryAddress | null {
  const id = String(raw.id ?? "").trim();
  const name = String(raw.name ?? "").trim();
  const phone = String(raw.phone ?? "").trim();
  const addressLine = String(raw.addressLine ?? raw.address ?? "").trim();
  const city = String(raw.city ?? "").trim() || "Local";
  const landmark = String(raw.landmark ?? "").trim();
  const pincode = String(raw.pincode ?? "").trim();
  if (!id || !name || !phone || !addressLine || !pincode) return null;
  const latRaw = raw.lat;
  const lngRaw = raw.lng;
  const lat = typeof latRaw === "number" && Number.isFinite(latRaw) ? latRaw : undefined;
  const lng = typeof lngRaw === "number" && Number.isFinite(lngRaw) ? lngRaw : undefined;
  return {
    id,
    userId: String(raw.userId ?? uid),
    label: parseLabel(raw.label),
    name,
    phone,
    addressLine,
    landmark,
    city,
    pincode,
    lat,
    lng,
    isDefault: Boolean(raw.isDefault),
    createdAt: tsToIso(raw.createdAt),
    updatedAt: tsToIso(raw.updatedAt)
  };
}

/** Parses `users/{uid}` `addresses` field (array of maps). */
export function parseAddressesField(uid: string, raw: unknown): DeliveryAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryAddress[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = embeddedMapToDelivery(uid, item as Record<string, unknown>);
    if (row) out.push(row);
  }
  return out;
}
