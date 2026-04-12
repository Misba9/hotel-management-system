export type MenuItemDoc = {
  id: string;
  name: string;
  price: number;
  category?: string;
  categoryId?: string;
  image?: string | null;
  imageUrl?: string | null;
  available?: boolean;
};

export type CartLine = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  qty: number;
};
