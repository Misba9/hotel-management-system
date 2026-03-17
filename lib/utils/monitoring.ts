import { adminDb } from "@shared/firebase/admin";

export function logServerInfo(message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log(JSON.stringify({ level: "info", message, context: context ?? {}, ts: new Date().toISOString() }));
  }
}

export function logServerError(message: string, error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        context: context ?? {},
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
        ts: new Date().toISOString()
      })
    );
  }
}

export async function captureApiError(input: {
  service: "customer-web" | "admin-dashboard" | "functions";
  route: string;
  error: unknown;
  context?: Record<string, unknown>;
}) {
  logServerError("API error captured", input.error, { service: input.service, route: input.route, ...(input.context ?? {}) });

  if (process.env.ERROR_MONITORING_ENABLED !== "true") return;
  try {
    const ref = adminDb.collection("error_logs").doc();
    await ref.set({
      id: ref.id,
      service: input.service,
      route: input.route,
      message: input.error instanceof Error ? input.error.message : String(input.error),
      stack: input.error instanceof Error ? input.error.stack ?? "" : "",
      context: input.context ?? {},
      createdAt: new Date().toISOString()
    });
  } catch (writeError) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to persist monitored error:", writeError);
    }
  }
}
