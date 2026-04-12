export type DeliveryOrderView = {
  id: string;
  status: string;
  totalAmount?: number;
  customerName?: string | null;
  phone?: string | null;
  deliveryAddress?: string | null;
  orderType?: string | null;
  createdAtMs: number;
};
