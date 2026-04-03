import type { Product } from "@/lib/menu-data-types";

/** One line in the shopping cart */
export type CartLine = {
  id: string;
  name: string;
  price: number;
  image: string;
  qty: number;
};

/** Alias for consumers that expect `CartItem` */
export type CartItem = CartLine;

export type CartProductInput = Pick<Product, "id" | "name" | "price" | "image">;

export type CartPayload = {
  userId?: string;
  items?: CartLine[];
  updatedAt?: string;
};
