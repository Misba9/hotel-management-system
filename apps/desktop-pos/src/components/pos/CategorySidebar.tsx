import { categoryIcon } from "@/lib/pos-theme";

type Props = {
  categories: string[];
  counts: Record<string, number>;
  active: string;
  onSelect: (category: string) => void;
};

export function CategorySidebar({ categories, counts, active, onSelect }: Props) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <aside className="pos-categories">
      <div className="pos-categories-header">
        <span className="pos-label">CATEGORIES</span>
        <div className="pos-cat-search-wrap">
          <span>🔍</span>
          <input className="pos-cat-search" placeholder="Search category…" />
        </div>
      </div>

      <button
        type="button"
        className={`pos-cat-row${active === "All" ? " active" : ""}`}
        onClick={() => onSelect("All")}
      >
        <span>{categoryIcon("all")}</span>
        <span className="pos-cat-name">All Items</span>
        <span className="pos-cat-count">({total})</span>
      </button>

      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className={`pos-cat-row${active === category ? " active" : ""}`}
          onClick={() => onSelect(category)}
        >
          <span>{categoryIcon(category)}</span>
          <span className="pos-cat-name">{category}</span>
          <span className="pos-cat-count">({counts[category] ?? 0})</span>
        </button>
      ))}
    </aside>
  );
}
