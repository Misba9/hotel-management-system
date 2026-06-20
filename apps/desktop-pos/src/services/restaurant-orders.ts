import { collection, doc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { getStaffDb } from "@/lib/firebase";
import { ORDERS_COLLECTION } from "@/services/orders";

export const APP_META_COLLECTION = "appMeta";
export const ORDER_TOKEN_DOC_ID = "orderToken";

export type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note?: string;
  modifications?: string[];
};

function linesToFirestoreItems(lines: CartLine[]) {
  return lines.map((line, idx) => ({
    productId: line.productId,
    name: line.name,
    qty: line.qty,
    price: line.unitPrice,
    unitPrice: line.unitPrice,
    id: line.productId || `line_${idx}`,
    ...(line.note ? { note: line.note } : {}),
    ...(line.modifications?.length ? { modifications: line.modifications } : {})
  }));
}

export function cartTotal(lines: CartLine[]): number {
  const t = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return Math.round(t * 100) / 100;
}

async function allocateNextTokenNumber(): Promise<number> {
  const db = getStaffDb();
  if (!db) throw new Error("Offline — cannot allocate token without cloud connection.");
  const metaRef = doc(db, APP_META_COLLECTION, ORDER_TOKEN_DOC_ID);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(metaRef);
    const cur = snap.exists() ? (snap.data() as { nextToken?: unknown }).nextToken : undefined;
    const n = typeof cur === "number" && Number.isFinite(cur) ? cur : 0;
    const token = n + 1;
    tx.set(metaRef, { nextToken: token, updatedAt: serverTimestamp() }, { merge: true });
    return token;
  });
}

export type PlacedRestaurantOrder = {
  orderId: string;
  tokenNumber: number;
  tableNumber: number;
  tableLabel: string;
  items: CartLine[];
  total: number;
};

export async function confirmCashierPosOrder(params: {
  orderType: "dine_in" | "parcel" | "online";
  lines: CartLine[];
  tableNumber?: number;
  tableFirestoreId?: string;
  tableDisplayName?: string;
  customerName?: string;
  phone?: string;
  source?: string;
  paymentMethod?: string;
  markPaid?: boolean;
  couponCode?: string;
  discountAmount?: number;
}): Promise<PlacedRestaurantOrder> {
  const db = getStaffDb();
  if (!db) throw new Error("Offline — place order locally via SQLite checkout.");
  if (params.lines.length === 0) throw new Error("Add at least one item to the cart.");
  const total = cartTotal(params.lines);
  const tokenNumber = await allocateNextTokenNumber();
  const orderRef = doc(collection(db, ORDERS_COLLECTION));
  const orderId = orderRef.id;
  const items = linesToFirestoreItems(params.lines);
  const ts = serverTimestamp();
  const tableNum = params.tableNumber ?? 0;
  const tableLabel =
    params.orderType === "dine_in"
      ? (params.tableDisplayName ?? "").trim() || (tableNum > 0 ? `Table ${tableNum}` : "Dine-in")
      : params.orderType === "online"
        ? "Online"
        : "Parcel";

  await setDoc(orderRef, {
    id: orderId,
    tableNumber: params.orderType === "dine_in" ? tableNum : null,
    tableId: params.tableFirestoreId ?? null,
    tableName: tableLabel,
    orderType: params.orderType,
    customerName: params.customerName?.trim() || null,
    phone: params.phone?.trim() || null,
    items,
    total,
    totalAmount: total,
    status: params.markPaid ? "completed" : "preparing",
    paymentStatus: params.markPaid ? "paid" : "pending",
    tokenNumber,
    createdAt: ts,
    updatedAt: ts,
    ...(params.source ? { source: params.source } : {}),
    ...(params.markPaid && params.paymentMethod ? { paymentMethod: params.paymentMethod, paidAt: ts } : {}),
    ...(params.couponCode ? { couponCode: params.couponCode } : {}),
    ...(params.discountAmount && params.discountAmount > 0 ? { discountAmount: params.discountAmount } : {})
  });

  return { orderId, tokenNumber, tableNumber: tableNum, tableLabel, items: params.lines, total };
}

export function computePosBillTotals(
  subtotal: number,
  taxPercent: number,
  discountPercent: number,
  serviceChargePercent: number,
  discountFlatAmount = 0
) {
  const s = Math.round(Number(subtotal) * 100) / 100;
  const fromPercent = Math.round(s * (discountPercent / 100) * 100) / 100;
  const flat = Math.round(Math.max(0, discountFlatAmount) * 100) / 100;
  const discountAmount = flat > 0 ? Math.min(flat, s) : fromPercent;
  const afterDiscount = Math.max(0, s - discountAmount);
  const serviceChargeAmount = Math.round(afterDiscount * (serviceChargePercent / 100) * 100) / 100;
  const taxable = afterDiscount + serviceChargeAmount;
  const taxAmount = Math.round(taxable * (taxPercent / 100) * 100) / 100;
  const grandTotal = Math.round((taxable + taxAmount) * 100) / 100;
  return {
    subtotal: s,
    discountPercent,
    discountAmount,
    serviceChargePercent,
    serviceChargeAmount,
    taxPercent,
    taxAmount,
    grandTotal
  };
}

export type PaymentMethodId = "cash" | "upi" | "qr" | "card" | "wallet" | "split";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  cash: "Cash",
  upi: "UPI",
  qr: "QR",
  card: "Card",
  wallet: "Wallet",
  split: "Split"
};

export const CASHIER_PAYMENT_METHODS: PaymentMethodId[] = ["cash", "upi", "card", "wallet", "split"];

export function calculateBillTotals(subtotal: number, taxPercent: number) {
  const s = Math.round(Number(subtotal) * 100) / 100;
  const tax = Math.round(s * (taxPercent / 100) * 100) / 100;
  const grandTotal = Math.round((s + tax) * 100) / 100;
  return { subtotal: s, taxPercent, taxAmount: tax, grandTotal };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildFinalInvoiceHtml(p: {
  orderIdShort: string;
  tableLabel: string;
  tokenLabel: string;
  items: CartLine[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethodLabel: string;
}): string {
  const rows = p.items
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.name)}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">₹${l.unitPrice.toFixed(2)}</td><td style="text-align:right">₹${(l.qty * l.unitPrice).toFixed(2)}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; max-width: 420px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 900; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 4px; }
    .grand { font-size: 18px; font-weight: 800; margin-top: 16px; }
  </style></head><body>
    <h1>Final Bill</h1>
    <p>Order ${escapeHtml(p.orderIdShort)} · ${escapeHtml(p.tableLabel)} · Token ${escapeHtml(p.tokenLabel)}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr></thead><tbody>${rows}</tbody></table>
    <p>Subtotal ₹${p.subtotal.toFixed(2)} · Tax (${p.taxPercent}%) ₹${p.taxAmount.toFixed(2)}</p>
    <p class="grand">Total ₹${p.grandTotal.toFixed(2)} · ${escapeHtml(p.paymentMethodLabel)}</p>
  </body></html>`;
}

export function buildKitchenKotHtml(p: {
  tokenLabel: string;
  tableLabel: string;
  items: CartLine[];
}): string {
  const rows = p.items.map((l) => `<tr><td>${escapeHtml(l.name)}</td><td>${l.qty}</td></tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body { font-family: monospace; padding: 16px; max-width: 300px; }
    h1 { font-size: 16px; text-align: center; }
  </style></head><body>
    <h1>KITCHEN TICKET</h1>
    <p>Token ${escapeHtml(p.tokenLabel)} · ${escapeHtml(p.tableLabel)}</p>
    <table>${rows}</table>
  </body></html>`;
}

async function printHtmlDocument(html: string): Promise<void> {
  const w = window.open("", "_blank");
  if (!w) throw new Error("Pop-up blocked — allow printing from this app.");
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export async function printFinalInvoice(p: Parameters<typeof buildFinalInvoiceHtml>[0]): Promise<void> {
  await printHtmlDocument(buildFinalInvoiceHtml(p));
}

export async function printKitchenKot(order: {
  items: Array<{ id?: string; name: string; price: number; qty: number }>;
  tokenNumber?: number;
  tableName?: string;
}): Promise<void> {
  const lines = staffOrderItemsToCartLines(order.items);
  const token =
    typeof order.tokenNumber === "number" && order.tokenNumber > 0 ? `#${order.tokenNumber}` : "—";
  await printHtmlDocument(
    buildKitchenKotHtml({ tokenLabel: token, tableLabel: order.tableName ?? "Parcel", items: lines })
  );
}

export function staffOrderItemsToCartLines(
  items: Array<{ id?: string; name: string; price: number; qty: number }>
): CartLine[] {
  return items.map((it, i) => ({
    productId: typeof it.id === "string" && it.id ? it.id : `line_${i}`,
    name: it.name,
    unitPrice: it.price,
    qty: it.qty > 0 ? it.qty : 1
  }));
}
