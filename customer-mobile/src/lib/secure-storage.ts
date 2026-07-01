import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "nausheen_customer_session";

export async function saveSessionToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, token);
  } catch {
    /* ignore */
  }
}

export async function getSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function clearSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
