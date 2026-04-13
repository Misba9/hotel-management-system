/**
 * Central logging for failures. Use from try/catch and async `.catch()` so issues are visible in Metro/console.
 */
const PREFIX = "[StaffApp]";

function formatUnknown(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  if (typeof err === "string") return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

/**
 * Log a caught error with a stable scope label (search console for `[StaffApp]`).
 */
export function logError(scope: string, err: unknown, extra?: Record<string, unknown>): void {
  const { message, stack } = formatUnknown(err);
  // eslint-disable-next-line no-console
  console.error(`${PREFIX} ${scope}`, message, extra && Object.keys(extra).length ? extra : "");
  if (stack) {
    // eslint-disable-next-line no-console
    console.error(stack);
  }
}

export function logWarn(scope: string, message: string, extra?: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(`${PREFIX} ${scope}`, message, extra ?? "");
}

/**
 * React error boundary / `componentDidCatch` — full diagnostic bundle.
 */
export function logReactError(error: Error, componentStack: string | null | undefined): void {
  // eslint-disable-next-line no-console
  console.error(`${PREFIX} Uncaught UI error`, error.message);
  if (error.stack) {
    // eslint-disable-next-line no-console
    console.error(error.stack);
  }
  if (componentStack) {
    // eslint-disable-next-line no-console
    console.error("Component stack:", componentStack);
  }
}
