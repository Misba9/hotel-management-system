import { productPlaceholder } from "@/lib/pos-theme";

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string | null;
  modifier_groups?: string | null;
};

type Props = {
  product: Product;
  quantity: number;
  selected?: boolean;
  onAdd: () => void;
  onDec: () => void;
};

export function ProductCard({ product, quantity, selected, onAdd, onDec }: Props) {
  return (
    <article className={`pos-product-card${selected ? " selected" : ""}`}>
      <div className="pos-product-image">
        {product.image ? (
          <img src={product.image} alt={product.name} />
        ) : (
          <span className="pos-product-emoji">{productPlaceholder(product.category)}</span>
        )}
      </div>
      <h3 className="pos-product-name">{product.name}</h3>
      <p className="pos-product-category">{product.category}</p>
      <p className="pos-product-price">₹{product.price}</p>
      <p className="pos-product-stock">🟢 Stock Available</p>
      <div className="pos-product-qty">
        <button type="button" className="pos-qty-btn" disabled={quantity <= 0} onClick={onDec}>
          −
        </button>
        <span>{quantity}</span>
        <button type="button" className="pos-qty-btn add" onClick={onAdd}>
          +
        </button>
      </div>
    </article>
  );
}
