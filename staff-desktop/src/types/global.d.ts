import type { StaffDesktopApi } from "../../electron/preload";

declare global {
  interface Window {
    staffDesktopApi?: StaffDesktopApi;
  }
}

export {};
