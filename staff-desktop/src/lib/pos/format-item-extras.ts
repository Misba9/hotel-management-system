import {
  formatItemExtras,
  formatItemExtrasForPrint,
  type ItemWithExtras
} from "@shared/lib/format-item-extras";

export { formatItemExtras, formatItemExtrasForPrint, type ItemWithExtras };

/** HTML sub-line under an item row on printed receipts */
export function formatItemExtrasHtml(item: ItemWithExtras): string {
  const extras = formatItemExtras(item);
  if (!extras) return "";
  return `<div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(extras)}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
