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
