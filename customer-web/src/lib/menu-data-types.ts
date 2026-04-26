export type Product = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  /**
   * Legacy Firestore field (`category`) — often a slug or label saved by admin instead of only `categoryId`.
   * Used for menu tab matching: `category === tab.name` when ids drift.
   */
  category?: string;
  price: number;
  rating: number;
  image: string;
  ingredients: string[];
  sizes: Array<{ label: "Small" | "Medium" | "Large"; multiplier: number }>;
  available: boolean;
  /** Mirrors Firestore `isAvailable`; missing means visible (`!== false`). */
  isAvailable?: boolean;
  featured?: boolean;
  popular?: boolean;
};

export type Category = {
  id: string;
  name: string;
  image: string;
  count: number;
  /** When false, hide from menu chrome; missing treats as active. */
  isActive?: boolean;
};

export type MenuPayload = {
  products: Product[];
  categories: Category[];
  fetchedAt: string;
};
