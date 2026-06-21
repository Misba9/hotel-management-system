/**
 * Guards for Firestore path segments — invalid ids cause INTERNAL ASSERTION failures on web/RN.
 */

export function assertNonEmptyPathSegment(value: unknown, label: string): string {
  const s = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!s) {
    throw new Error(`Invalid Firestore ${label}: empty id.`);
  }
  return s;
}

export function assertValidOrderId(orderId: unknown): string {
  return assertNonEmptyPathSegment(orderId, "orderId");
}

export function assertValidTableId(tableId: unknown): string {
  return assertNonEmptyPathSegment(tableId, "tableId");
}

export function assertValidCollectionName(name: unknown): string {
  return assertNonEmptyPathSegment(name, "collection name");
}

export function assertValidUid(uid: unknown): string {
  return assertNonEmptyPathSegment(uid, "userId");
}

/** Non-throwing guard — logs and returns `null` when id is missing. */
export function requireFirestoreId(value: unknown, label: string): string | null {
  const s = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!s) {
    console.error(`Missing ${label}`);
    return null;
  }
  return s;
}

export function requireDeliveryId(deliveryId: unknown): string | null {
  return requireFirestoreId(deliveryId, "deliveryId");
}
