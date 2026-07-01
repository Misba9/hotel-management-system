import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;

declare const process: { env: Record<string, string | undefined> };

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromExtra = typeof extra?.apiBaseUrl === "string" ? extra.apiBaseUrl.trim() : "";
  return fromExtra || "http://localhost:3000";
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, init);
}
