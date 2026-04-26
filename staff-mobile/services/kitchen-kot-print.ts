/**
 * Kitchen Order Ticket (KOT) — plain-text layout + HTML print via expo-print.
 *
 * Future transports (plug in without changing call sites):
 * - BLE thermal: react-native-ble-plx + ESC/POS byte encoder
 * - LAN raw: TCP socket to host:9100 with ESC/POS
 */
import * as Print from "expo-print";
import { Alert, Platform } from "react-native";

import type { StaffOrderRow } from "./orders";

export type KitchenKotPrintSource = "auto" | "manual";

export type KitchenKotTransportId = "expo_html" | "ble_escpos" | "lan_raw";

/** Reserved for a future registry of transports (BLE / LAN). */
export type KitchenKotPrintHooks = {
  /** Called before default HTML print; return true to skip expo-print. */
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
  const ts = order.createdAt;
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

/** Fixed-width style KOT body for thermal-style output. */
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
    ? order.items.map((i) => `${i.qty} x ${i.name}`).join("\n")
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

/**
 * Print KOT for an order. Auto flow should not use Alert; manual may show a dev preview.
 */
export async function printKitchenKot(
  order: StaffOrderRow,
  options: { source: KitchenKotPrintSource }
): Promise<void> {
  const receipt = formatKitchenKotReceipt(order);
  if (__DEV__) {
    console.log("PRINT:\n", receipt);
  }

  const handled = await printHooks.tryCustomTransport?.(receipt, order.id, options.source);
  if (handled) return;

  await printHtmlDocument(receiptToPrintHtml(receipt));

  if (__DEV__ && options.source === "manual") {
    const preview = receipt.length > 3500 ? `${receipt.slice(0, 3500)}\n…` : receipt;
    Alert.alert("Printing...", preview);
  }
}
