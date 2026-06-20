import type { StaffOrderRow } from "../../../services/orders";
import { canonicalOrderStatus } from "../../../services/orders";
import { resolveOrderSource } from "./order-source";

export type TestPlatform = "parcel" | "swiggy" | "zomato" | "online" | "waiter";

const SAMPLE_ITEMS = [
  { name: "Mango Juice", price: 120 },
  { name: "Fruit Salad", price: 180 },
  { name: "Pineapple Shake", price: 150 },
  { name: "Mixed Fruit Bowl", price: 220 },
  { name: "Watermelon Juice", price: 100 },
  { name: "Avocado Smoothie", price: 200 }
];

const CUSTOMERS = [
  { name: "Rahul Sharma", phone: "9876543210", address: "12 MG Road, Bangalore" },
  { name: "Priya Patel", phone: "9123456789", address: "45 Park Street, Mumbai" },
  { name: "Amit Kumar", phone: "9988776655", address: "78 Brigade Road, Chennai" },
  { name: "Sneha Reddy", phone: "9112233445", address: "23 Jubilee Hills, Hyderabad" },
  { name: "Vikram Singh", phone: "9001122334", address: "56 Connaught Place, Delhi" }
];

const WAITERS = [
  { name: "Ahmed", avatar: "👨" },
  { name: "Rajesh", avatar: "👨‍🍳" },
  { name: "Suresh", avatar: "🧑‍💼" },
  { name: "Kiran", avatar: "👩‍🍳" }
];

const STATUSES = ["preparing", "ready", "accepted", "completed", "cancelled"] as const;
const PAYMENTS = ["pending", "paid"] as const;

function mockTimestamp(date: Date) {
  return { toDate: () => date };
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomItems() {
  const count = 1 + Math.floor(Math.random() * 4);
  const shuffled = [...SAMPLE_ITEMS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((item, i) => ({
    id: `item-${i}`,
    name: item.name,
    price: item.price,
    qty: 1 + Math.floor(Math.random() * 2)
  }));
}

function platformFields(platform: TestPlatform): Partial<StaffOrderRow> & Record<string, unknown> {
  switch (platform) {
    case "parcel":
      return { orderType: "parcel", source: "pos" };
    case "swiggy":
      return { orderType: "online", source: "swiggy", platform: "swiggy" };
    case "zomato":
      return { orderType: "online", source: "zomato", platform: "zomato" };
    case "online":
      return { orderType: "online", source: "website", platform: "website" };
    case "waiter":
      return {
        orderType: "dine_in",
        source: "waiter",
        tableNumber: 1 + Math.floor(Math.random() * 20),
        tableName: `Table ${1 + Math.floor(Math.random() * 20)}`,
        waiterName: pick(WAITERS).name,
        guestCount: 1 + Math.floor(Math.random() * 8)
      };
  }
}

export function createTestOrder(
  platform: TestPlatform,
  opts?: { status?: string; paymentStatus?: string; minutesAgo?: number }
): StaffOrderRow {
  const customer = pick(CUSTOMERS);
  const items = randomItems();
  const totalAmount = items.reduce((s, i) => s + i.price * i.qty, 0);
  const status = opts?.status ?? pick(STATUSES);
  const paymentStatus = opts?.paymentStatus ?? (status === "completed" ? "paid" : pick(PAYMENTS));
  const minutesAgo = opts?.minutesAgo ?? Math.floor(Math.random() * 120);
  const created = new Date(Date.now() - minutesAgo * 60_000);
  const id = `test-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const pf = platformFields(platform);
  const orderType = typeof pf.orderType === "string" ? pf.orderType : undefined;

  const order = {
    id,
    items,
    totalAmount,
    status,
    paymentStatus,
    createdAt: mockTimestamp(created),
    updatedAt: mockTimestamp(created),
    assignedTo: { kitchenId: undefined, deliveryId: undefined, kitchen: undefined, delivery: undefined },
    customer: { name: customer.name, phone: customer.phone, address: customer.address },
    deliveryLocation: { lat: 0, lng: 0 },
    canonicalStatus: canonicalOrderStatus(status, orderType),
    orderType,
    tokenNumber: platform === "parcel" ? Math.floor(Math.random() * 99) + 1 : undefined,
    ...(pf as Partial<StaffOrderRow>)
  } as StaffOrderRow;

  if (status === "cancelled") {
    (order as StaffOrderRow & Record<string, unknown>).cancelledBy = pick(["Cashier", "Manager", "System"]);
    (order as StaffOrderRow & Record<string, unknown>).cancelReason = pick([
      "Customer request",
      "Out of stock",
      "Duplicate order",
      "Payment failed"
    ]);
  }

  if (paymentStatus === "refunded") {
    order.paymentStatus = "refunded";
    (order as StaffOrderRow & Record<string, unknown>).refundedAt = mockTimestamp(new Date());
  }

  return order;
}

export function generateTestOrders(
  platform: TestPlatform | "mixed",
  count = 1,
  opts?: { randomStatus?: boolean; randomPayment?: boolean; randomTime?: boolean }
): StaffOrderRow[] {
  const platforms: TestPlatform[] =
    platform === "mixed" ? ["parcel", "swiggy", "zomato", "online", "waiter"] : [platform];
  const orders: StaffOrderRow[] = [];

  for (let i = 0; i < count; i++) {
    const p = platform === "mixed" ? pick(platforms) : platform;
    orders.push(
      createTestOrder(p, {
        status: opts?.randomStatus ? pick(STATUSES) : undefined,
        paymentStatus: opts?.randomPayment ? pick([...PAYMENTS, "refunded"]) : undefined,
        minutesAgo: opts?.randomTime ? Math.floor(Math.random() * 240) : undefined
      })
    );
  }
  return orders;
}

export function partitionOrdersByPlatform(orders: StaffOrderRow[]) {
  const parcelOrders: StaffOrderRow[] = [];
  const swiggyOrders: StaffOrderRow[] = [];
  const zomatoOrders: StaffOrderRow[] = [];
  const onlineOrders: StaffOrderRow[] = [];
  const waiterOrders: StaffOrderRow[] = [];

  for (const o of orders) {
    const src = resolveOrderSource(o);
    if (src === "swiggy") swiggyOrders.push(o);
    else if (src === "zomato") zomatoOrders.push(o);
    else if (src === "website" || src === "qr" || src === "phone" || src === "online") onlineOrders.push(o);
    else if (src === "waiter" || src === "dine_in") waiterOrders.push(o);
    else parcelOrders.push(o);
  }

  return { parcelOrders, swiggyOrders, zomatoOrders, onlineOrders, waiterOrders };
}
