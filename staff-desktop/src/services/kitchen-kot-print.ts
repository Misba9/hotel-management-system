/**
 * Kitchen Order Ticket (KOT) — plain-text layout + HTML print.
 * Electron thermal printing is wired via setKitchenKotPrintHooks from the POS layer.
 */
import { formatItemExtras, formatItemExtrasForPrint } from "@/lib/pos/format-item-extras";
import type { StaffOrderRow } from "./orders";
import { isDesktopRuntime, getDesktopApi } from "@/lib/desktop-api";

export type KitchenKotPrintSource = "auto" | "manual";

export type KitchenKotTransportId = "expo_html" | "ble_escpos" | "lan_raw";

export type KitchenKotPrintHooks = {
  tryCustomTransport?: (receipt: string, orderId: string, source: KitchenKotPrintSource) => Promise<boolean>;
};

let printHooks: KitchenKotPrintHooks = {};

export function setKitchenKotPrintHooks(hooks: KitchenKotPrintHooks): void {
  printHooks = hooks;
}

export const KITCHEN_RECEIPT_BRAND = "NAUSHEEN FRUITS JUICE";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCreatedAt(order: StaffOrderRow): string {
  const ts = order.createdAt as { toMillis?: () => number; seconds?: number } | null;
  const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : undefined;
  if (typeof ms === "number" && Number.isFinite(ms)) {
    return new Date(ms).toLocaleString();
  }
  const sec = (ts as { seconds?: number } | null)?.seconds;
  if (typeof sec === "number" && Number.isFinite(sec)) {
    return new Date(sec * 1000).toLocaleString();
  }
  return "-";
}

export function formatKitchenKotReceipt(order: StaffOrderRow): string {
  const time = formatCreatedAt(order);
  const table =
    typeof order.tableNumber === "number" && Number.isFinite(order.tableNumber)
      ? String(order.tableNumber)
      : "-";
  const token =
    typeof order.tokenNumber === "number" && Number.isFinite(order.tokenNumber) && order.tokenNumber > 0
      ? String(order.tokenNumber)
      : "-";
  const statusRaw = String(order.status ?? order.canonicalStatus ?? "-");
  const itemsBlock = order.items.length
    ? order.items
        .map((i) => {
          const row = i as { qty: number; name: string; note?: string; modifications?: string[] };
          const line = `${row.qty} x ${row.name}`;
          const extras = formatItemExtrasForPrint(row);
          return extras ? `${line}\n   ${extras}` : line;
        })
        .join("\n")
    : "(no items)";

  return `
================================
     ${KITCHEN_RECEIPT_BRAND}
================================

Order ID : ${order.id}
Table    : ${table}
Token    : ${token}
Time     : ${time}

--------------------------------
ITEMS
--------------------------------
${itemsBlock}

--------------------------------

Status   : ${statusRaw.toUpperCase()}

================================
     *** KITCHEN COPY ***
================================
`;
}

function receiptToPrintHtml(receipt: string): string {
  const body = escapeHtml(receipt.trim());
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { margin: 0; padding: 12px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; color: #000; background: #fff; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
  </style></head><body><pre>${body}</pre></body></html>`;
}

async function printHtmlDocument(html: string): Promise<void> {
  const w = window.open("", "_blank");
  if (w?.document?.write) {
    w.document.write(html);
    w.document.close();
    w.focus?.();
    w.print?.();
  }
}

async function tryElectronKotPrint(order: StaffOrderRow): Promise<boolean> {
  if (!isDesktopRuntime()) return false;
  const result = await getDesktopApi().printKot({
    orderNumber: order.id.slice(-8).toUpperCase(),
    source: String(order.orderType ?? "kitchen"),
    createdAt: new Date().toISOString(),
    items: order.items.map((i) => {
      const row = i as { name: string; qty: number; note?: string; modifications?: string[] };
      const extras = formatItemExtras(row);
      return {
        name: row.name,
        quantity: row.qty,
        ...(extras ? { notes: extras } : {})
      };
    })
  });
  return result.ok;
}

export async function printKitchenKot(
  order: StaffOrderRow,
  options: { source: KitchenKotPrintSource }
): Promise<void> {
  const receipt = formatKitchenKotReceipt(order);

  const handled = await printHooks.tryCustomTransport?.(receipt, order.id, options.source);
  if (handled) return;

  if (await tryElectronKotPrint(order)) return;

  await printHtmlDocument(receiptToPrintHtml(receipt));
}
