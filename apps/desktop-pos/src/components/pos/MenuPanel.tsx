import { ProductCard } from "./ProductCard";
import type { ReactNode, Ref } from "react";

type Product = {
  id: number | string;
  name: string;
  price: number;
  category: string;
  image: string | null;
};

type Props = {
  products: Product[];
  search: string;
  onSearchChange: (value: string) => void;
  cartQty: Record<number | string, number>;
  selectedProductId: number | string | null;
  onAdd: (product: Product) => void;
  onDec: (productId: number | string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  headerAction?: ReactNode;
  orderToolbar?: ReactNode;
  menuError?: string | null;
};

export function MenuPanel({
  products,
  search,
  onSearchChange,
  cartQty,
  selectedProductId,
  onAdd,
  onDec,
  searchInputRef,
  headerAction,
  orderToolbar,
  menuError
}: Props) {
  return (
    <section className="pos-menu">
      <div className="pos-menu-toolbar">
        <div className="pos-menu-search-wrap">
          <span>🔍</span>
          <input
            ref={searchInputRef}
            className="pos-menu-search"
            placeholder="Search products… (F1 or /)"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {headerAction}
        <button type="button" className="pos-discount-chip">F6 Discount</button>
      </div>

      {orderToolbar}

      {menuError ? <p className="pos-menu-error">{menuError}</p> : null}

      <div className="pos-product-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={{ ...product, id: Number(product.id) || 0, modifier_groups: null }}
            quantity={cartQty[product.id] ?? 0}
            selected={selectedProductId === product.id}
            onAdd={() => onAdd(product)}
            onDec={() => onDec(product.id)}
          />
        ))}
      </div>
    </section>
  );
}
