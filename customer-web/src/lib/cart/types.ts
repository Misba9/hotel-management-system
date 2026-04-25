import type { Product } from "@/lib/menu-data-types";
import { resolveMenuImageSrc } from "@/lib/image-url";

/** One line in the shopping cart */
export type CartLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
};

/** Alias for consumers that expect `CartItem` */
export type CartItem = CartLine;

export type CartProductInput = Pick<Product, "id" | "name" | "price" | "image">;

export type CartPayload = {
  userId?: string;
  items?: CartLine[];
  updatedAt?: string;
};

/** Accept Firestore/API/localStorage lines that used `id` + `qty`. */
export function normalizeCartLine(raw: unknown): CartLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productIdRaw = o.productId ?? o.id;
  const productId = typeof productIdRaw === "string" ? productIdRaw.trim() : "";
  if (!productId) return null;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  const price = Number(o.price);
  if (!Number.isFinite(price) || price < 0) return null;
  const qtyRaw = o.quantity ?? o.qty;
  const quantity = typeof qtyRaw === "number" && Number.isInteger(qtyRaw) ? qtyRaw : NaN;
  if (!Number.isFinite(quantity) || quantity < 1) return null;
  const imageRaw = typeof o.image === "string" ? o.image : "";
  const image = resolveMenuImageSrc(imageRaw);
  return { productId, name, price, quantity, image };
}
