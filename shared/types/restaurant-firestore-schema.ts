import type { Timestamp } from "firebase/firestore";

/** Root paths — use with `doc(db, …)` / `collection(db, …)`. */
export const STAFF_USERS_COLLECTION = "staffUsers" as const;
export const TABLES_COLLECTION_PATH = "tables" as const;
export const PRODUCTS_COLLECTION_PATH = "products" as const;
export const ORDERS_COLLECTION_PATH = "orders" as const;
export const DELIVERIES_COLLECTION_PATH = "deliveries" as const;
export const PRINTERS_COLLECTION_PATH = "printers" as const;

export type StaffUserRole = string;

/** `staffUsers/{uid}` — doc id should equal `uid`. */
export interface StaffUserDoc {
  uid: string;
  name: string;
  role: StaffUserRole;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type TableFloorStatus = "free" | "occupied";

/** `tables/{tableId}` — `tableNumber` is the display number. */
export interface TableDoc {
  id?: string;
  tableNumber: number;
  status: TableFloorStatus | "FREE" | "OCCUPIED";
  currentOrderId?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

/** `products/{productId}` — storefront / POS line catalog. */
export interface RestaurantProductDoc {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  /** Kept for compatibility with existing rules and menu tooling. */
  availability?: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type RestaurantOrderStatus = "pending" | "preparing" | "ready" | "served";
export type RestaurantPaymentStatus = "pending" | "paid";

export interface RestaurantOrderLineItem {
  productId?: string;
  name: string;
  qty: number;
  unitPrice?: number;
  lineTotal?: number;
}

/**
 * Slim dine-in ticket on `orders/{orderId}` (no `userId` / `branchId` / pipeline fields).
 * Write `createdAt` / `updatedAt` with `serverTimestamp()` from the client or `FieldValue.serverTimestamp()` from Admin.
 */
export interface RestaurantLifecycleOrderDoc {
  id: string;
  tableNumber: number;
  items: RestaurantOrderLineItem[];
  total: number;
  status: RestaurantOrderStatus;
  paymentStatus: RestaurantPaymentStatus;
  tokenNumber: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp | null;
}

export type DeliveryRunStatus = "assigned" | "picked" | "delivered";

/** `deliveries/{deliveryId}` */
export interface DeliveryDoc {
  orderId: string;
  customerName: string;
  mobile: string;
  address: string;
  status: DeliveryRunStatus;
  /** Staff Firebase Auth uid of the rider when assigned. */
  deliveryBoyId?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type PrinterConnectionType = "wifi" | "bluetooth";

/** `printers/{printerId}` */
export interface PrinterDoc {
  name: string;
  type: PrinterConnectionType;
  /** Host/IP for Wi‑Fi printers; optional for Bluetooth. */
  ipAddress?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}
