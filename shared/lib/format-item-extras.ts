/** Item with optional cashier modifications and free-text note. */
export type ItemWithExtras = {
  modifications?: string[];
  note?: string;
};

export function formatItemExtras(item: ItemWithExtras): string {
  const parts = [...(item.modifications ?? [])];
  if (item.note?.trim()) parts.push(item.note.trim());
  return parts.join(" · ");
}

export function formatItemExtrasForPrint(item: ItemWithExtras): string {
  const extras = formatItemExtras(item);
  return extras ? `+ ${extras}` : "";
}

/** One-line label for lists: `1× Juice · Extra sugar · No ice`. */
export function formatOrderLineWithExtras(item: {
  qty: number;
  name: string;
  modifications?: string[];
  note?: string;
}): string {
  const base = `${item.qty}× ${item.name}`;
  const extras = formatItemExtras(item);
  return extras ? `${base} · ${extras}` : base;
}
