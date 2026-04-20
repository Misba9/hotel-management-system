import { doc, setDoc } from "firebase/firestore";
import { db, ensureFirestoreOnline } from "@/lib/firebase";

/** Flat summary on `users/{userId}.address` (mirrors form lines + phone). */
export type UserAddressPayload = {
  fullAddress: string;
  city: string;
  pincode: string;
  phone: string;
};

/**
 * Writes `users/{userId}.address` with merge. Keeps same field names the app already uses.
 * `fullAddress` comes from `data.fullAddress` or `data.addressLine` when passed from forms.
 */
export async function saveUserAddress(
  userId: string,
  data: UserAddressPayload | { addressLine: string; city: string; pincode: string; phone: string }
): Promise<boolean> {
  try {
    const fullAddress =
      "fullAddress" in data ? data.fullAddress.trim() : data.addressLine.trim();
    const city = data.city.trim();
    const pincode = data.pincode.trim();
    const phone = data.phone.trim();

    console.log("[saveUserAddress] start", userId, { fullAddress: fullAddress.slice(0, 48), city, pincode });

    await ensureFirestoreOnline();
    const ref = doc(db, "users", userId);

    await setDoc(
      ref,
      {
        address: {
          fullAddress,
          city,
          pincode,
          phone,
          updatedAt: new Date()
        }
      },
      { merge: true }
    );

    console.log("[saveUserAddress] success");
    return true;
  } catch (error) {
    console.error("[saveUserAddress] error", error);
    throw error;
  }
}
