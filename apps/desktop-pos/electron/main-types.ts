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
