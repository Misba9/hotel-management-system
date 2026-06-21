export type StaffDesktopSettings = {
  counterPrinterInterface: string | null;
  kitchenPrinterInterface: string | null;
  fullscreen: boolean;
  autoLaunch: boolean;
  soundNotifications: boolean;
  restaurantName: string;
};

export const DEFAULT_SETTINGS: StaffDesktopSettings = {
  counterPrinterInterface: null,
  kitchenPrinterInterface: null,
  fullscreen: false,
  autoLaunch: false,
  soundNotifications: true,
  restaurantName: "Nausheen Fruits"
};

export type PrinterDevice = {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
};

export type CachedOrderRecord = {
  id: number;
  payload: string;
  createdAt: string;
  synced: boolean;
  error?: string | null;
};

export type PrintInvoicePayload = {
  orderNumber: string;
  tableNumber?: string;
  source: string;
  paymentMethod: string;
  createdAt: string;
  specialNotes?: string;
  items: Array<{ name: string; quantity: number; price: number; notes?: string }>;
  subtotal: number;
  tax: number;
  total: number;
};

export type PrintKotPayload = {
  orderNumber: string;
  source: string;
  createdAt: string;
  specialNotes?: string;
  items: Array<{ name: string; quantity: number; notes?: string }>;
};

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export type OfflineSyncStatus = {
  online: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  syncing: boolean;
};
