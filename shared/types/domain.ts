/** SaaS multi-tenant `orders` documents (subset of lifecycle vs restaurant `OrderStatus`). */
export const saasOrderStatuses = ["pending", "preparing", "ready", "delivered"] as const;
export type SaaSOrderStatus = (typeof saasOrderStatuses)[number];

export interface SaaSOrderLineItem {
  name: string;
  price: number;
  qty: number;
}

export type OrderType = "delivery" | "pickup" | "dine_in";
export type PaymentMethod = "upi" | "card" | "cod";
export type OrderStatus = "pending" | "preparing" | "ready" | "out_for_delivery" | "delivered";
export type StaffRole = "delivery_boy" | "kitchen_staff" | "waiter" | "cashier" | "manager" | "admin";

export interface Branch {
  id: string;
  name: string;
  city: string;
  location: { lat: number; lng: number };
  active: boolean;
}

export interface MenuItem {
  id: string;
  branchId: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  available: boolean;
}

export interface Order {
  id: string;
  userId: string;
  branchId: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  dayKey: string;
  createdAt: string;
}

/**
 * Firestore-backed order fields used when mapping `orders/{id}` for list/API responses
 * (fields may be partial vs a full `Order` depending on write path).
 */
export interface OrderFirestoreData {
  userId?: string;
  totalAmount?: number;
  total?: number;
  status?: string;
  createdAt?: unknown;
  address?: string | null;
  trackingId?: string;
  items?: unknown;
  paymentMethod?: string;
  paymentStatus?: string;
}

/** One row returned by `GET /api/user/orders` (customer storefront history). */
export interface UserOrderListItem {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  address?: string;
  trackingId?: string;
  itemsSummary: string;
  paymentMethod?: string;
  paymentStatus?: string;
}

export type UserOrdersApiResponse =
  | { success: true; items: UserOrderListItem[] }
  | { error: string };
