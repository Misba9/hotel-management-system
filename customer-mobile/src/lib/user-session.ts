import { auth } from "@/src/lib/firebase";

export async function buildUserHeaders(base?: HeadersInit): Promise<Headers> {
  const headers = new Headers(base);
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function buildAuthHeaders(base?: HeadersInit): Promise<Headers> {
  const headers = new Headers(base);
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required.");
  }
  const token = await currentUser.getIdToken();
  headers.set("Authorization", `Bearer ${token}`);
  return headers;
}
