export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.staffDesktopApi);
}

export function getDesktopApi() {
  if (!window.staffDesktopApi) {
    throw new Error("staffDesktopApi is only available in the Electron runtime");
  }
  return window.staffDesktopApi;
}
