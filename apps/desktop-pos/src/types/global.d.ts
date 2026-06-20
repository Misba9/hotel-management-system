import type { PosApi } from "../electron/preload";

declare global {
  interface Window {
    posApi: PosApi;
  }
}

export {};
