import type { FirebaseMenuProduct } from "@shared/lib/firebase-menu";
import type { Product } from "./menu-data-types";
import { resolveMenuImageSrc } from "./image-url";

export function mapFirebaseProductToProduct(p: FirebaseMenuProduct): Product {
  const categoryName = p.category || "Other";
  return {
    id: p.id,
    name: p.name,
    description: "",
    categoryId: categoryName.toLowerCase().replace(/\s+/g, "-"),
    categoryName,
    category: categoryName,
    price: p.price,
    rating: 4.5,
    image: resolveMenuImageSrc(p.image),
    ingredients: [],
    sizes: [{ label: "Medium", multiplier: 1 }],
    available: p.inStock,
    isAvailable: p.inStock
  };
}
