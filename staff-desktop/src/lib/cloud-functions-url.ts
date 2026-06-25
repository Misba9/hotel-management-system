/** Same-origin proxy path — see vite.config.ts `server.proxy`. Avoids CORS in local dev. */
export const DEV_FUNCTIONS_PROXY_PREFIX = "/api/cloud-fn";

function trimEnv(raw: string | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  return raw.trim().replace(/^["']|["']$/g, "");
}

function env(name: string): string | undefined {
  return trimEnv(import.meta.env[name as keyof ImportMetaEnv] as string | undefined);
}

export function getFirebaseProjectId(): string | undefined {
  return env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? env("VITE_FIREBASE_PROJECT_ID");
}

/** Cloud Functions origin, e.g. https://us-central1-my-project.cloudfunctions.net */
export function getCloudFunctionsOrigin(): string {
  const explicit =
    env("VITE_CLOUD_FUNCTIONS_ORIGIN") ?? env("NEXT_PUBLIC_CLOUD_FUNCTIONS_ORIGIN");
  if (explicit) return explicit.replace(/\/$/, "");

  const projectId = getFirebaseProjectId();
  if (projectId) return `https://us-central1-${projectId}.cloudfunctions.net`;
  return "https://us-central1-nausheen-fruits-new.cloudfunctions.net";
}

/** HTTP function base URL (`platformApiV1`). Uses Vite proxy in dev. */
export function getPlatformApiBaseUrl(): string {
  const explicit =
    env("NEXT_PUBLIC_PLATFORM_API_URL") ??
    env("VITE_PLATFORM_API_URL") ??
    env("NEXT_PUBLIC_API_BASE_URL") ??
    env("VITE_API_BASE_URL");
  if (explicit) return explicit.replace(/\/$/, "");

  if (import.meta.env.DEV) {
    return `${DEV_FUNCTIONS_PROXY_PREFIX}/platformApiV1`;
  }

  return `${getCloudFunctionsOrigin()}/platformApiV1`;
}

/** Callable URL — same-origin proxy in dev, direct Cloud Functions URL in production. */
export function getCallableFunctionUrl(functionName: string): string {
  if (import.meta.env.DEV) {
    return `${window.location.origin}${DEV_FUNCTIONS_PROXY_PREFIX}/${functionName}`;
  }
  return `${getCloudFunctionsOrigin()}/${functionName}`;
}
