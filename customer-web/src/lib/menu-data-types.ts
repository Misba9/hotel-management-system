export type Product = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  price: number;
  rating: number;
  image: string;
  ingredients: string[];
  sizes: Array<{ label: "Small" | "Medium" | "Large"; multiplier: number }>;
  available: boolean;
  featured?: boolean;
  popular?: boolean;
};

export type Category = {
  id: string;
  name: string;
  image: string;
  count: number;
};

export type MenuPayload = {
  products: Product[];
  categories: Category[];
  fetchedAt: string;
};
