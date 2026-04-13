import { logError } from "./lib/error-logging";

type ErrorUtilsShape = {
  getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

/**
 * Attach React Native global JS error handler so fatals are logged with `[StaffApp]` before the default handler runs.
 */
export function installGlobalErrorHandlers(): void {
  try {
    // `ErrorUtils` exists on React Native but is not always in public typings.
    const ErrorUtils = (require("react-native") as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
    if (!ErrorUtils?.setGlobalHandler) return;
    const prev = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      logError(isFatal ? "GlobalHandler.fatal" : "GlobalHandler", error, { isFatal: Boolean(isFatal) });
      prev(error, isFatal);
    });
  } catch (e) {
    logError("bootstrap-global-errors.install", e);
  }
}
