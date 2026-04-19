import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type UserAddressPayload = {
  fullAddress: string;
  city: string;
  pincode: string;
  phone: string;
};

/** Flat `users/{userId}.address` map (dashboards / debugging) — complements `addresses[]` used by checkout. */
export async function saveUserAddress(userId: string, addressData: UserAddressPayload): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);

    await setDoc(
      userRef,
      {
        address: addressData,
        updatedAt: new Date()
      },
      { merge: true }
    );

    if (process.env.NODE_ENV !== "production") {
      console.log("Address saved");
    }
  } catch (error) {
    console.error("Error saving address:", error);
    throw error;
  }
}
