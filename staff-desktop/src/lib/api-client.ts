function trimEnv(raw: string | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  return raw.trim().replace(/^["']|["']$/g, "");
}

function env(name: string): string | undefined {
  return trimEnv(import.meta.env[name as keyof ImportMetaEnv] as string | undefined);
}

/** Cloud Functions HTTP API (`platformApiV1`). */
export function getPlatformApiBaseUrl(): string {
  const explicit =
    env("NEXT_PUBLIC_PLATFORM_API_URL") ??
    env("VITE_PLATFORM_API_URL") ??
    env("NEXT_PUBLIC_API_BASE_URL") ??
    env("VITE_API_BASE_URL");
  if (explicit) return explicit.replace(/\/$/, "");

  const projectId = env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? env("VITE_FIREBASE_PROJECT_ID");
  if (projectId) {
    return `https://us-central1-${projectId}.cloudfunctions.net/platformApiV1`;
  }
  return "";
}

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
