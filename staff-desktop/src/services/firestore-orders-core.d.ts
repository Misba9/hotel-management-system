export type MappedOrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

export type MappedOrderDoc = {
  id: string;
  items: MappedOrderItem[];
  totalAmount: number;
  riderId?: string;
  status: string;
  createdAt: unknown;
  updatedAt: unknown;
  assignedTo: { kitchenId?: string; deliveryId?: string; kitchen?: string; delivery?: string };
  customer: { name: string; address: string; phone: string };
  createdByUid?: string;
  orderType?: string;
  deliveryLocation?: { lat: number; lng: number };
  riderLocation?: { lat: number; lng: number };
};

export const ORDERS_COLLECTION: string;
export const MANAGER_ORDERS_LIMIT: number;
export function mapOrderDoc(id: string, data: Record<string, unknown>): MappedOrderDoc;
export function updateOrderStatus(orderId: string, status: string, extra?: Record<string, unknown>): Promise<void>;
