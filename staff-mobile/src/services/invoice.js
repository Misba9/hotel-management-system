/**
 * Receipt HTML → PDF (expo-print), system print, and plain-text share.
 */
import { Platform, Share } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const HOTEL_NAME = process.env.EXPO_PUBLIC_HOTEL_NAME || "Fruit Hotel";

/**
 * @param {{
 *   id?: string;
 *   orderId?: string;
 *   items: { name: string; price: number; qty: number }[];
 *   subtotal?: number;
 *   tax?: number;
 *   total?: number;
 *   totalAmount?: number;
 *   customer?: { name?: string; phone?: string; address?: string };
 *   createdAt?: string | Date | null;
 * }} order
 */
export function buildInvoiceHtml(order) {
  const oid = order.orderId ?? order.id ?? "";
  const when =
    order.createdAt instanceof Date
      ? order.createdAt.toLocaleString()
      : typeof order.createdAt === "string"
        ? order.createdAt
        : new Date().toLocaleString();
  const subtotal = Number(order.subtotal ?? 0);
  const tax = Number(order.tax ?? 0);
  const total = Number(order.total ?? order.totalAmount ?? 0);

  const rows = (order.items || [])
    .map(
      (line) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(line.name)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${line.qty}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">₹${Number(line.price).toFixed(0)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">₹${(Number(line.price) * Number(line.qty)).toFixed(0)}</td>
    </tr>`
    )
    .join("");
  const cust = order.customer || {};
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Receipt ${escapeHtml(String(oid).slice(0, 12))}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#111;padding:24px;max-width:520px;margin:0 auto;">
  <h1 style="margin:0 0 4px;font-size:22px;color:#E23744;">${escapeHtml(HOTEL_NAME)}</h1>
  <p style="margin:0 0 20px;color:#64748b;font-size:13px;">Tax invoice / Receipt</p>
  <p style="font-size:13px;"><strong>Order</strong> #${escapeHtml(String(oid).slice(0, 14))}${String(oid).length > 14 ? "…" : ""}</p>
  <p style="font-size:13px;color:#64748b;">${escapeHtml(when)}</p>
  ${cust.name ? `<p style="font-size:13px;"><strong>Guest</strong> ${escapeHtml(cust.name)} · ${escapeHtml(cust.phone || "")}</p>` : ""}
  <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
    <thead><tr style="background:#FFF1F2;">
      <th style="text-align:left;padding:8px;">Item</th>
      <th style="padding:8px;">Qty</th>
      <th style="text-align:right;padding:8px;">Price</th>
      <th style="text-align:right;padding:8px;">Subtotal</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:20px;font-size:15px;text-align:right;line-height:1.6;">
    <div>Subtotal: <strong>₹${subtotal.toFixed(0)}</strong></div>
    <div>Tax: <strong>₹${tax.toFixed(0)}</strong></div>
    <div style="font-size:20px;font-weight:800;margin-top:8px;">Total: ₹${total.toFixed(0)}</div>
  </div>
  <p style="font-size:11px;color:#94a3b8;margin-top:32px;">Thank you for dining with us.</p>
</body></html>`;
}

/**
 * @param {Parameters<typeof buildInvoiceHtml>[0]} order
 */
export function buildInvoicePlainText(order) {
  const oid = order.orderId ?? order.id ?? "";
  const subtotal = Number(order.subtotal ?? 0);
  const tax = Number(order.tax ?? 0);
  const total = Number(order.total ?? order.totalAmount ?? 0);
  const lines = (order.items || []).map(
    (l) => `  ${l.name} x${l.qty} @ ₹${Number(l.price).toFixed(0)} = ₹${(Number(l.price) * Number(l.qty)).toFixed(0)}`
  );
  return [
    HOTEL_NAME,
    "Receipt",
    `Order: ${oid}`,
    "",
    ...lines,
    "",
    `Subtotal: ₹${subtotal.toFixed(0)}`,
    `Tax: ₹${tax.toFixed(0)}`,
    `Total: ₹${total.toFixed(0)}`,
    "",
    "Thank you."
  ].join("\n");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {Parameters<typeof buildInvoiceHtml>[0]} order
 * @returns {Promise<string>} local PDF file URI
 */
export async function generateInvoicePdf(order) {
  const html = buildInvoiceHtml(order);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/** @deprecated Use {@link generateInvoicePdf} */
export async function generateInvoice(order) {
  return generateInvoicePdf(order);
}

/**
 * Opens system print dialog (native).
 * @param {Parameters<typeof buildInvoiceHtml>[0]} order
 */
export async function printInvoice(order) {
  const html = buildInvoiceHtml(order);
  await Print.printAsync({ html });
}

/**
 * @param {string} pdfUri from {@link generateInvoicePdf}
 */
export async function shareInvoicePdf(pdfUri) {
  const can = await Sharing.isAvailableAsync();
  if (!can) throw new Error("Sharing is not available on this device.");
  await Sharing.shareAsync(pdfUri, {
    mimeType: "application/pdf",
    dialogTitle: "Share receipt"
  });
}

/**
 * @param {Parameters<typeof buildInvoiceHtml>[0]} order
 */
export async function shareInvoiceText(order) {
  const body = buildInvoicePlainText(order);
  if (Platform.OS === "web") {
    await Share.share({ message: body, title: "Receipt" });
    return;
  }
  await Share.share({ message: body, title: `${HOTEL_NAME} receipt` });
}
