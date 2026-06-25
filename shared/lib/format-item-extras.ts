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
