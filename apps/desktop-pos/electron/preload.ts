import { contextBridge, ipcRenderer } from "electron";

export type PosProduct = {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string | null;
  modifier_groups: string | null;
};

export type PosCheckoutItem = {
  productId: number;
  quantity: number;
  price: number;
  notes?: string;
  name?: string;
};

export type PosCheckoutPayload = {
  tableNumber?: string;
  source: "dine-in" | "takeaway" | "zomato" | "swiggy";
  items: PosCheckoutItem[];
  paymentMethod: string;
  specialNotes?: string;
};

export type KitchenOrderPayload = {
  orderId: number;
  orderNumber: string;
  tableNumber?: string;
  source: "dine-in" | "takeaway" | "zomato" | "swiggy";
  total: number;
  status: "pending" | "preparing" | "ready";
  createdAt: string;
  specialNotes?: string;
  items: Array<{
    productId: number;
    name: string;
    quantity: number;
    price: number;
    notes?: string;
  }>;
};

export type HubInfo = {
  port: number;
  localIp: string;
};

export type SyncStatusPayload = {
  online: boolean;
  unsyncedCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  syncing: boolean;
};

const posApi = {
  getProducts: (): Promise<PosProduct[]> => ipcRenderer.invoke("db:getProducts"),
  getCategories: (): Promise<string[]> => ipcRenderer.invoke("db:getCategories"),
  checkout: (payload: PosCheckoutPayload): Promise<KitchenOrderPayload> =>
    ipcRenderer.invoke("db:checkout", payload),
  emitNewOrder: (order: KitchenOrderPayload): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("hub:emitNewOrder", order),
  getHubInfo: (): Promise<HubInfo> => ipcRenderer.invoke("hub:getInfo"),
  getSyncStatus: (): Promise<SyncStatusPayload> => ipcRenderer.invoke("sync:getStatus"),
  onSyncStatus: (handler: (status: SyncStatusPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: SyncStatusPayload) => {
      handler(status);
    };
    ipcRenderer.on("sync:status", listener);
    return () => ipcRenderer.removeListener("sync:status", listener);
  },
  registerFcmToken: (token: string, deviceName?: string): Promise<{ ok: boolean; deviceId?: string; error?: string }> =>
    ipcRenderer.invoke("fcm:registerToken", token, deviceName),
  notifyPlatformOrder: (data: Record<string, string>): void => {
    ipcRenderer.send("fcm:platform-order", data);
  },
  onOrderCreated: (handler: (result: KitchenOrderPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: KitchenOrderPayload) => {
      handler(result);
    };
    ipcRenderer.on("order:created", listener);
    return () => ipcRenderer.removeListener("order:created", listener);
  }
};

contextBridge.exposeInMainWorld("posApi", posApi);

export type PosApi = typeof posApi;
