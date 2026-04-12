export type KitchenOrderRow = {
  orderId: string;
  status: string;
  type?: string;
  totalAmount?: number;
  createdAt?: string;
  items: Array<{ name: string; qty: number }>;
};
