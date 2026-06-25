import { getPlatformApiBaseUrl } from "./cloud-functions-url";

export { getPlatformApiBaseUrl } from "./cloud-functions-url";

export async function fetchWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const { getStaffDesktopAuth } = await import("./firebase");
  const auth = await getStaffDesktopAuth();
  const user = auth?.currentUser;
  if (!user) throw new Error("Not signed in.");

  const token = await user.getIdToken();
  const base = getPlatformApiBaseUrl();
  if (!base) throw new Error("Platform API URL is not configured.");

  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}

export async function pingPlatformApi(): Promise<boolean> {
  try {
    const base = getPlatformApiBaseUrl();
    if (!base) return false;
    const response = await fetchWithAuth("/", { method: "GET" });
    return response.ok || response.status === 404 || response.status === 405;
  } catch {
    return false;
  }
}
