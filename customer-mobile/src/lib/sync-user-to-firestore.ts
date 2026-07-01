import type { User } from "firebase/auth";
import { mirrorUserAddressesToCustomerDoc, upsertCustomerOnLogin } from "@/src/lib/customer-doc-sync";
import { createUserIfNotExists, mergeUserLoginStamp } from "@/src/lib/user-service";

export async function syncUserToFirestore(user: User): Promise<void> {
  await createUserIfNotExists(user);
  await mergeUserLoginStamp(user);
  await upsertCustomerOnLogin(user);
  await mirrorUserAddressesToCustomerDoc(user.uid);
}
