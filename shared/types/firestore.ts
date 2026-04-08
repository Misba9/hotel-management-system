import type { Timestamp } from "firebase/firestore";
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  SaaSOrderLineItem,
  SaaSOrderStatus,
  StaffRole
} from "./domain";

/** Root collection path for SaaS tenant orders: `orders/{orderId}` */
export const SAAS_ORDERS_COLLECTION = "orders" as const;

export interface UserDoc {
  id: string;
  phone: string;
  fullName: string;
  role: StaffRole | "customer";
  loyaltyPoints: number;
  referralCode: string;
  createdAt: string;
}

export interface RoleDoc {
  id: StaffRole;
  permissions: string[];
}

export interface MenuCategoryDoc {
  id: string;
  branchId: string;
  name: string;
  priority: number;
  active: boolean;
}

export interface MenuItemDoc {
  id: string;
  branchId: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  available: boolean;
  tags: string[];
}

/**
 * Firestore document for SaaS `orders` collection.
 * Use document id as `id` when writing for idempotent client mapping.
 */
export interface SaaSOrderDoc {
  id: string;
  /** @deprecated Legacy multi-tenant field; optional on existing documents. */
  tenantId?: string;
  items: SaaSOrderLineItem[];
  totalAmount: number;
  status: SaaSOrderStatus;
  createdAt: Timestamp;
  customerName: string;
}

export interface OrderDoc {
  id: string;
  userId: string;
  branchId: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  statusBucket: "active" | "completed";
  subtotal: number;
  discount: number;
  deliveryFee: number;
  couponCode?: string;
  total: number;
  customerLocation?: { lat: number; lng: number };
  dayKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemDoc {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PaymentDoc {
  id: string;
  orderId: string;
  status: "pending" | "paid" | "failed";
  method: PaymentMethod;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  amount: number;
  verifiedAt?: string;
}

export interface AddressDoc {
  id: string;
  userId: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

export interface DeliveryAssignmentDoc {
  id: string;
  orderId: string;
  deliveryBoyId: string;
  status: "assigned" | "picked_up" | "delivered";
  distanceKm: number;
  workloadAtAssign: number;
  estimatedMinutes?: number;
  assignedAt: string;
  updatedAt: string;
}

export interface StaffDoc {
  id: string;
  userId: string;
  branchId: string;
  role: StaffRole;
  online: boolean;
  activeOrders: number;
  location?: { lat: number; lng: number };
  performanceScore: number;
}

export interface InventoryDoc {
  id: string;
  branchId: string;
  ingredientName: string;
  unit: "kg" | "litre" | "pieces";
  currentStock: number;
  minStock: number;
  isLowStock: boolean;
  updatedAt: string;
}

export interface CouponDoc {
  id: string;
  code: string;
  active: boolean;
  discountType: "percent" | "flat";
  discountValue: number;
  minOrderAmount: number;
  usageLimit: number;
  usedCount: number;
  expiryAt: string;
}

export interface NotificationDoc {
  id: string;
  userId: string;
  title: string;
  body: string;
  seen: boolean;
  createdAt: string;
}

export interface BranchDoc {
  id: string;
  name: string;
  city: string;
  address: string;
  location: { lat: number; lng: number };
  deliveryRadiusKm: number;
  active: boolean;
}
