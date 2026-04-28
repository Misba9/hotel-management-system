import { collection, doc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import * as Print from "expo-print";
import { Platform } from "react-native";

import { staffDb } from "../src/lib/firebase";
import { ORDERS_COLLECTION } from "../src/services/orders.js";
import { patchWaiterTable } from "./tables";

export const APP_META_COLLECTION = "appMeta";
export const ORDER_TOKEN_DOC_ID = "orderToken";

export type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
};

function linesToFirestoreItems(lines: CartLine[]) {
  return lines.map((line, idx) => ({
    productId: line.productId,
    name: line.name,
    qty: line.qty,
    price: line.unitPrice,
    unitPrice: line.unitPrice,
    id: line.productId || `line_${idx}`
  }));
}

export function cartTotal(lines: CartLine[]): number {
  const t = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return Math.round(t * 100) / 100;
}

async function allocateNextTokenNumber(): Promise<number> {
  const metaRef = doc(staffDb, APP_META_COLLECTION, ORDER_TOKEN_DOC_ID);
  const next = await runTransaction(staffDb, async (tx) => {
    const snap = await tx.get(metaRef);
    const cur = snap.exists() ? (snap.data() as { nextToken?: unknown }).nextToken : undefined;
    const n = typeof cur === "number" && Number.isFinite(cur) ? cur : 0;
    const token = n + 1;
    tx.set(
      metaRef,
      {
        nextToken: token,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return token;
  });
  return next;
}

export type PlacedRestaurantOrder = {
  orderId: string;
  tokenNumber: number;
  tableNumber: number;
  tableLabel: string;
  items: CartLine[];
  total: number;
};

/**
 * Writes dine-in lifecycle order: `pending` (kitchen sees it), `paymentStatus` pending.
 * Optionally marks the floor table occupied with `currentOrderId`.
 */
export async function confirmRestaurantOrder(params: {
  tableFirestoreId: string;
  tableNumber: number;
  /** Shown on ticket / receipt (e.g. T1). */
  tableDisplayName?: string;
  lines: CartLine[];
  linkTable?: boolean;
}): Promise<PlacedRestaurantOrder> {
  if (params.lines.length === 0) throw new Error("Add at least one item to the cart.");
  const total = cartTotal(params.lines);
  const tokenNumber = await allocateNextTokenNumber();
  const orderRef = doc(collection(staffDb, ORDERS_COLLECTION));
  const orderId = orderRef.id;
  const items = linesToFirestoreItems(params.lines);
  const ts = serverTimestamp();
  const tableLabel =
    (params.tableDisplayName ?? "").trim() ||
    (params.tableNumber > 0 ? `Table ${params.tableNumber}` : "Walk-in");

  await setDoc(orderRef, {
    id: orderId,
    tableNumber: params.tableNumber,
    tableId: params.tableFirestoreId,
    tableName: tableLabel,
    items,
    total,
    status: "pending",
    paymentStatus: "pending",
    tokenNumber,
    createdAt: ts,
    updatedAt: ts
  });

  if (params.linkTable) {
    try {
      /** Only mark occupied — supports multiple open tickets per table (do not overwrite `currentOrderId`). */
      await patchWaiterTable(params.tableFirestoreId, { status: "OCCUPIED" });
    } catch {
      // Table rules may fail if role mismatch — order still placed.
    }
  }

  return {
    orderId,
    tokenNumber,
    tableNumber: params.tableNumber,
    tableLabel,
    items: params.lines,
    total
  };
}

export function buildReceiptHtml(p: {
  tokenNumber: number;
  tableNumber: number;
  tableLabel?: string;
  items: CartLine[];
  total: number;
  draft?: boolean;
  /** Overrides default receipt title (e.g. KDS chit). */
  title?: string;
}): string {
  const rows = p.items
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.name)}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">₹${l.unitPrice.toFixed(0)}</td><td style="text-align:right">₹${(l.qty * l.unitPrice).toFixed(0)}</td></tr>`
    )
    .join("");
  const draftNote = p.draft ? `<p style="color:#64748b;font-size:12px">Draft — not saved</p>` : "";
  const heading = p.title ?? (p.draft ? "Receipt (draft)" : "NAUSHEEN JUICE CENTER");
  const tokenLabel =
    typeof p.tokenNumber === "number" && p.tokenNumber > 0 ? `#${p.tokenNumber}` : "—";
  const tableLine =
    (p.tableLabel ?? "").trim() ||
    (p.tableNumber > 0 ? `Table ${p.tableNumber}` : "—");
  const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; max-width: 360px; margin: 0 auto; }
    .rule { border: none; border-top: 2px solid #0f172a; margin: 12px 0; }
    h1 { font-size: 16px; margin: 0 0 4px; text-align: center; letter-spacing: 0.04em; }
    .meta { font-size: 14px; line-height: 1.6; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 4px; font-size: 14px; }
    th { text-align: left; font-size: 12px; color: #64748b; }
    .total { margin-top: 16px; font-size: 18px; font-weight: 800; text-align: center; }
  </style></head><body>
    <hr class="rule"/>
    <h1>${escapeHtml(heading)}</h1>
    <hr class="rule"/>
    ${draftNote}
    <div class="meta"><strong>Table</strong> ${escapeHtml(tableLine)}</div>
    <div class="meta"><strong>Time</strong> ${escapeHtml(now)}</div>
    <div class="meta"><strong>Token</strong> ${escapeHtml(String(tokenLabel))}</div>
    <p style="font-weight:800;margin-top:16px;margin-bottom:4px">Items</p>
    <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Each</th><th style="text-align:right">Line</th></tr></thead><tbody>${rows}</tbody></table>
    <hr class="rule"/>
    <p class="total">Total: ₹${p.total.toFixed(0)}</p>
    <hr class="rule"/>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function printHtmlDocument(html: string): Promise<void> {
  if (Platform.OS === "web") {
    const win = (globalThis as { window?: { open?: (u: string, t: string) => unknown } }).window;
    const w = win?.open?.("", "_blank") as
      | { document?: { write: (h: string) => void; close: () => void }; focus?: () => void; print?: () => void }
      | null
      | undefined;
    if (w?.document?.write) {
      w.document.write(html);
      w.document.close();
      w.focus?.();
      w.print?.();
    }
    return;
  }
  await Print.printAsync({ html });
}

export async function printRestaurantReceipt(p: {
  tokenNumber: number;
  tableNumber: number;
  tableLabel?: string;
  items: CartLine[];
  total: number;
  draft?: boolean;
  title?: string;
}): Promise<void> {
  await printHtmlDocument(buildReceiptHtml(p));
}

/** Default GST-style rate shown on cashier invoice (subtotal is Firestore `total`). */
export const DEFAULT_INVOICE_TAX_PERCENT = 5;

export type PaymentMethodId = "cash" | "upi" | "qr" | "card";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  cash: "Cash",
  upi: "UPI",
  qr: "QR",
  card: "Card"
};

export function calculateBillTotals(subtotal: number, taxPercent: number): {
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
} {
  const s = Math.round(Number(subtotal) * 100) / 100;
  const tax = Math.round(s * (taxPercent / 100) * 100) / 100;
  const grandTotal = Math.round((s + tax) * 100) / 100;
  return { subtotal: s, taxPercent, taxAmount: tax, grandTotal };
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
        `<tr>
          <td>${escapeHtml(l.name)}</td>
          <td style="text-align:center">${l.qty}</td>
          <td style="text-align:right">₹${l.unitPrice.toFixed(2)}</td>
          <td style="text-align:right">₹${(l.qty * l.unitPrice).toFixed(2)}</td>
        </tr>`
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 28px; color: #0f172a; background: #fff; }
    .invoice { max-width: 420px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
    .brand { font-size: 11px; letter-spacing: 0.2em; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    h1 { font-size: 22px; font-weight: 900; margin: 0 0 16px; letter-spacing: -0.02em; }
    .meta { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px; }
    .meta strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; padding: 10px 8px; border-bottom: 2px solid #0f172a; }
    td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .totals { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .tot-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 15px; }
    .tot-row.muted { color: #64748b; font-size: 14px; }
    .tot-row.grand { font-size: 20px; font-weight: 900; margin-top: 8px; padding-top: 12px; border-top: 2px solid #0f172a; }
    .pay { margin-top: 18px; padding: 12px 14px; background: #f8fafc; border-radius: 8px; font-size: 14px; font-weight: 700; }
  </style></head><body>
    <div class="invoice">
      <div class="brand">Tax invoice</div>
      <h1>Final bill</h1>
      <div class="meta">
        <div><strong>Order</strong> ${escapeHtml(p.orderIdShort)}</div>
        <div><strong>Table</strong> ${escapeHtml(p.tableLabel)}</div>
        <div><strong>Token</strong> ${escapeHtml(p.tokenLabel)}</div>
      </div>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="tot-row"><span>Subtotal</span><span>₹${p.subtotal.toFixed(2)}</span></div>
        <div class="tot-row muted"><span>Tax (${p.taxPercent}%)</span><span>₹${p.taxAmount.toFixed(2)}</span></div>
        <div class="tot-row grand"><span>Total due</span><span>₹${p.grandTotal.toFixed(2)}</span></div>
      </div>
      <div class="pay">Payment: ${escapeHtml(p.paymentMethodLabel)} — PAID</div>
    </div>
  </body></html>`;
}

export async function printFinalInvoice(p: {
  orderIdShort: string;
  tableLabel: string;
  tokenLabel: string;
  items: CartLine[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethodLabel: string;
}): Promise<void> {
  await printHtmlDocument(buildFinalInvoiceHtml(p));
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

/** Auto-print on new KDS ticket — same line layout as counter receipt. */
export async function printKitchenTicketForStaffOrder(row: {
  items: Array<{ id?: string; name: string; price: number; qty: number }>;
  totalAmount: number;
  tableNumber?: number;
  tokenNumber?: number;
}): Promise<void> {
  const lines = staffOrderItemsToCartLines(row.items);
  const total = row.totalAmount;
  const tableNumber = typeof row.tableNumber === "number" ? row.tableNumber : 0;
  const tokenNumber = typeof row.tokenNumber === "number" && row.tokenNumber > 0 ? row.tokenNumber : 0;
  await printRestaurantReceipt({
    tokenNumber,
    tableNumber,
    tableLabel: typeof row.tableNumber === "number" ? `Table ${row.tableNumber}` : undefined,
    items: lines,
    total,
    draft: false,
    title: "Kitchen ticket"
  });
}