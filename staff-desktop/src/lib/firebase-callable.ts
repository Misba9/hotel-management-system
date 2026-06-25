import { httpsCallable, httpsCallableFromURL, type Functions, type HttpsCallable } from "firebase/functions";
import { getCallableFunctionUrl } from "./cloud-functions-url";

/** Callable that uses the Vite dev proxy in development (avoids browser CORS). */
export function staffDesktopCallable<TRequest = unknown, TResponse = unknown>(
  functions: Functions,
  functionName: string
): HttpsCallable<TRequest, TResponse> {
  const url = getCallableFunctionUrl(functionName);
  if (import.meta.env.DEV) {
    return httpsCallableFromURL<TRequest, TResponse>(functions, url);
  }
  return httpsCallable<TRequest, TResponse>(functions, functionName);
}
