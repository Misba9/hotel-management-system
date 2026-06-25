import { contextBridge, ipcRenderer } from "electron";
import type {
  CachedOrderRecord,
  FirebaseClientConfig,
  OfflineSyncStatus,
  PrintInvoicePayload,
  PrintKotPayload,
  PrinterDevice,
  RazorpayInitiatePayload,
  RazorpayInitiateResult,
  RazorpayVerifyPayload,
  StaffDesktopSettings
} from "./main-types";

const staffDesktopApi = {
  getSettings: (): Promise<StaffDesktopSettings> => ipcRenderer.invoke("settings:get"),
  saveSettings: (partial: Partial<StaffDesktopSettings>): Promise<StaffDesktopSettings> =>
    ipcRenderer.invoke("settings:save", partial),
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke("window:toggleFullscreen"),
  isFullscreen: (): Promise<boolean> => ipcRenderer.invoke("window:isFullscreen"),
  listPrinters: (): Promise<PrinterDevice[]> => ipcRenderer.invoke("printer:list"),
  printInvoice: (payload: PrintInvoicePayload): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("printer:printInvoice", payload),
  printKot: (payload: PrintKotPayload): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("printer:printKot", payload),
  getFirebaseConfig: (): Promise<FirebaseClientConfig> => ipcRenderer.invoke("firebase:getClientConfig"),
  enqueueOfflineOrder: (payload: Record<string, unknown>): Promise<{ id: number }> =>
    ipcRenderer.invoke("offline:enqueue", payload),
  listPendingOrders: (): Promise<CachedOrderRecord[]> => ipcRenderer.invoke("offline:listPending"),
  markOrderSynced: (id: number): Promise<{ ok: boolean }> => ipcRenderer.invoke("offline:markSynced", id),
  markOrderFailed: (id: number, error: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("offline:markFailed", id, error),
  getOfflineStatus: (): Promise<OfflineSyncStatus> => ipcRenderer.invoke("offline:getStatus"),
  setOnline: (online: boolean): Promise<OfflineSyncStatus> => ipcRenderer.invoke("offline:setOnline", online),
  notifySyncStarted: (): Promise<OfflineSyncStatus> => ipcRenderer.invoke("offline:syncStarted"),
  notifySyncFinished: (result: { ok: boolean; error?: string }): Promise<OfflineSyncStatus> =>
    ipcRenderer.invoke("offline:syncFinished", result),
  playNewOrderSound: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("sound:playNewOrder"),
  onOfflineStatus: (handler: (status: OfflineSyncStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: OfflineSyncStatus) => handler(status);
    ipcRenderer.on("offline:status", listener);
    return () => ipcRenderer.removeListener("offline:status", listener);
  },
  onSyncRequest: (handler: () => void): (() => void) => {
    const listener = () => handler();
    ipcRenderer.on("offline:sync-request", listener);
    return () => ipcRenderer.removeListener("offline:sync-request", listener);
  },
  onNewOrderSound: (handler: () => void): (() => void) => {
    const listener = () => handler();
    ipcRenderer.on("sound:new-order", listener);
    return () => ipcRenderer.removeListener("sound:new-order", listener);
  },
  razorpayGetKeyId: (): Promise<string> => ipcRenderer.invoke("razorpay:getKeyId"),
  razorpayInitiate: (payload: RazorpayInitiatePayload): Promise<RazorpayInitiateResult> =>
    ipcRenderer.invoke("razorpay:initiate", payload),
  razorpayVerify: (payload: RazorpayVerifyPayload): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("razorpay:verify", payload)
};

contextBridge.exposeInMainWorld("staffDesktopApi", staffDesktopApi);

export type StaffDesktopApi = typeof staffDesktopApi;
