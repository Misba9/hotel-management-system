/** Admin menu — category row from `categories` (legacy reads may merge `menu_categories`). */
export type CategoryRow = {
  id: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
  priority: number;
};

/** Admin menu — product row from `products`. */
export type MenuItemRow = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName: string;
  imageUrl: string;
  size: string;
  ingredients: string;
  available: boolean;
};

export type MenuProductFormValues = {
  name: string;
  price: number;
  categoryId: string;
  size: string;
  ingredients: string;
  imageUrl: string;
  available: boolean;
};

export type CategoryFormValues = {
  name: string;
  imageUrl: string;
};
