import Constants from "expo-constants";
import { Platform } from "react-native";

const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;

declare const process: { env: Record<string, string | undefined> };

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Expo Go / Metro host (LAN IP or hostname) from the running packager.
 * Physical devices cannot reach `localhost` on the developer machine.
 */
function getExpoPackagerHost(): string | null {
  const anyConstants = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    experienceUrl?: string;
    linkingUri?: string;
    manifest?: { debuggerHost?: string; hostUri?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string; debuggerHost?: string } } };
  };

  const candidates = [
    anyConstants.expoConfig?.hostUri,
    anyConstants.manifest2?.extra?.expoClient?.hostUri,
    anyConstants.manifest2?.extra?.expoClient?.debuggerHost,
    anyConstants.manifest?.debuggerHost,
    anyConstants.manifest?.hostUri,
    typeof extra?.debuggerHost === "string" ? extra.debuggerHost : null
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const host = String(raw).split(":")[0]?.trim();
    if (host && host !== "localhost" && host !== "127.0.0.1") return host;
  }
  return null;
}

function isLoopbackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/**
 * Resolves the customer-web API base URL.
 * Rewrites localhost → Expo LAN host on native so physical devices can reach the Mac/PC.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const fromExtra = typeof extra?.apiBaseUrl === "string" ? extra.apiBaseUrl.trim() : "";
  let base = stripTrailingSlash(fromEnv || fromExtra || "http://localhost:3000");

  if (Platform.OS !== "web" && isLoopbackUrl(base)) {
    const lanHost = getExpoPackagerHost();
    if (lanHost) {
      try {
        const u = new URL(base);
        u.hostname = lanHost;
        base = stripTrailingSlash(u.toString());
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("[api] Rewrote localhost API base for device →", base);
        }
      } catch {
        /* keep original */
      }
    } else if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        "[api] API base is localhost but Expo hostUri is unknown. " +
          "Set EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:3000 in customer-mobile/.env"
      );
    }
  }

  return base;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[apiFetch]", init?.method ?? "GET", url);
  }
  try {
    return await fetch(url, init);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[apiFetch] Network failure", { url, base, error });
    const err = new Error(
      `Cannot reach API at ${base}. On a physical phone, set EXPO_PUBLIC_API_BASE_URL to http://<Mac-LAN-IP>:3000 and ensure customer-web is running.`
    ) as Error & { code?: string; cause?: unknown };
    err.code = "auth/network-request-failed";
    err.cause = error;
    throw err;
  }
}
