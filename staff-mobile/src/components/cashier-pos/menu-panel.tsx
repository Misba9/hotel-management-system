import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInput
} from "react-native";
import type { CartLine, MenuItemDoc, MenuQuickFilter } from "./pos-types";
import { PosComboSection } from "./pos-combo-section";
import { PosIcon } from "./pos-icons";
import { PosChip, PosEmpty, PosInput } from "./pos-ui";
import { posCard, posColors, posPanel, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  products: MenuItemDoc[];
  grouped: Record<string, MenuItemDoc[]>;
  categories: readonly string[];
  selectedCategory: string;
  quickFilter: MenuQuickFilter;
  search: string;
  cartQtyById: Record<string, number>;
  recentProductIds: string[];
  loading: boolean;
  error: string | null;
  onCategorySelect: (cat: string) => void;
  onQuickFilter: (f: MenuQuickFilter) => void;
  onSearchChange: (v: string) => void;
  onAdd: (item: MenuItemDoc) => void;
  onDec: (item: MenuItemDoc) => void;
  onAddCombo: (lines: CartLine[]) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  searchInputRef?: React.Ref<TextInput>;
  /** Hide horizontal category chips when using left CategorySidebar */
  showCategoryTabs?: boolean;
  /** Grid columns — auto if omitted */
  numColumns?: number;
  onBarcodeScan?: () => void;
  onQuickDiscount?: () => void;
};

const QUICK: { id: MenuQuickFilter; label: string; icon?: "star" | "trending" }[] = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites", icon: "star" },
  { id: "popular", label: "Popular", icon: "trending" },
  { id: "recent", label: "Recent" },
  { id: "combos", label: "Combos" }
];

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

export function MenuPanel({
  products,
  grouped,
  categories,
  selectedCategory,
  quickFilter,
  search,
  cartQtyById,
  recentProductIds,
  loading,
  error,
  onCategorySelect,
  onQuickFilter,
  onSearchChange,
  onAdd,
  onDec,
  onAddCombo,
  favoriteIds,
  onToggleFavorite,
  searchInputRef,
  showCategoryTabs = true,
  numColumns,
  onBarcodeScan,
  onQuickDiscount
}: Props) {
  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list =
      selectedCategory === "all"
        ? products.filter((p) => p.available !== false)
        : (grouped[selectedCategory] ?? []).filter((p) => p.available !== false);

    if (quickFilter === "favorites") list = list.filter((p) => favoriteIds.has(p.id));
    if (quickFilter === "popular") list = [...list].sort((a, b) => b.price - a.price).slice(0, 24);
    if (quickFilter === "recent") {
      const set = new Set(recentProductIds);
      list = list.filter((p) => set.has(p.id));
      if (list.length === 0) list = products.slice(0, 8);
    }

    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
    return list;
  }, [products, grouped, selectedCategory, search, quickFilter, recentProductIds, favoriteIds]);

  const cols = numColumns ?? 2;

  if (quickFilter === "combos") {
    return (
      <View style={[posPanel(), styles.panel]}>
        <View style={styles.header}>
          <Text style={posType.h3}>Combo Builder</Text>
          <Text style={posType.small}>One-click meal deals</Text>
        </View>
        <PosComboSection products={products} onAddCombo={onAddCombo} />
      </View>
    );
  }

  return (
    <View style={[posPanel(), styles.panel]}>
      <View style={styles.header}>
        <Text style={posType.h3}>Products</Text>
        <Text style={posType.small}>{visibleProducts.length} items</Text>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <PosIcon name="search" size={16} color={posColors.textDim} />
          <PosInput
            ref={searchInputRef}
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search products… (F1 menu /)"
            style={styles.search}
          />
        </View>
        <Pressable onPress={onBarcodeScan} style={styles.toolBtn}>
          <Text style={styles.toolBtnText}>Scan</Text>
        </Pressable>
        <Pressable onPress={onQuickDiscount} style={styles.toolBtn}>
          <Text style={styles.toolBtnText}>% Disc</Text>
        </Pressable>
      </View>

      {showCategoryTabs ? (
        <>
          <FlatList
            horizontal
            data={QUICK}
            keyExtractor={(i) => i.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <PosChip
                label={item.label}
                icon={item.icon}
                active={quickFilter === item.id}
                onPress={() => onQuickFilter(item.id)}
              />
            )}
          />

          <FlatList
            horizontal
            data={categories}
            keyExtractor={(c) => c}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.chips, { paddingTop: 0 }]}
            renderItem={({ item: cat }) => (
              <PosChip label={cat === "all" ? "All Categories" : cat} active={selectedCategory === cat} onPress={() => onCategorySelect(cat)} />
            )}
          />
        </>
      ) : null}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={posColors.primary} size="large" />
        </View>
      ) : error ? (
        <PosEmpty message="Menu unavailable" hint={error} />
      ) : (
        <FlatList
          data={visibleProducts}
          keyExtractor={(item) => item.id}
          numColumns={cols}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator
          ListEmptyComponent={<PosEmpty message="No products found" hint="Try another category or search" />}
          renderItem={({ item }) => {
            const qty = cartQtyById[item.id] ?? 0;
            const img = item.imageUrl ?? item.image;
            const isFav = favoriteIds.has(item.id);
            const isBest = item.isBestSeller ?? item.name.length % 4 === 0;
            return (
              <Pressable onPress={() => onAdd(item)} style={[posCard(true), styles.tile]}>
                <Pressable onPress={() => onToggleFavorite(item.id)} style={styles.favBtn} hitSlop={8}>
                  <PosIcon name="star" size={14} color={isFav ? posColors.warning : posColors.textDim} />
                </Pressable>
                {isBest ? <Text style={styles.bestBadge}>Best Seller</Text> : null}
                {img ? (
                  <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <PosIcon name="parcel" size={24} color={posColors.textDim} />
                  </View>
                )}
                <Text numberOfLines={2} style={styles.name}>
                  {item.name}
                </Text>
                <Text style={styles.category}>{item.category ?? "Menu"} · Stock {item.stockQty ?? "OK"}</Text>
                <Text style={styles.price}>{formatMoney(item.price)}</Text>
                {item.rating ? <Text style={styles.rating}>★ {item.rating.toFixed(1)}</Text> : null}
                <View style={styles.qtyRow}>
                  <Pressable onPress={() => onDec(item)} disabled={qty <= 0} style={[styles.qtyBtn, qty <= 0 && styles.qtyBtnOff]}>
                    <PosIcon name="minus" size={14} color={qty <= 0 ? posColors.textDim : posColors.text} />
                  </Pressable>
                  <Text style={styles.qty}>{qty}</Text>
                  <Pressable onPress={() => onAdd(item)} style={[styles.qtyBtn, styles.qtyBtnAdd]}>
                    <PosIcon name="plus" size={14} color="#fff" />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRightWidth: 0 },
  header: { padding: posSpacing.lg, borderBottomWidth: 1, borderBottomColor: posColors.border },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    marginHorizontal: posSpacing.lg,
    marginTop: posSpacing.md,
    flexWrap: "wrap"
  },
  toolBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.card
  },
  toolBtnText: { fontSize: 11, fontWeight: "800", color: posColors.textSecondary },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    flex: 1,
    minWidth: 160
  },
  search: { flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingVertical: 8 },
  chips: { paddingHorizontal: posSpacing.lg, paddingVertical: posSpacing.sm, gap: posSpacing.sm },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: { padding: posSpacing.md, paddingBottom: posSpacing.huge },
  gridRow: { gap: posSpacing.md },
  tile: {
    flex: 1,
    margin: posSpacing.xs,
    padding: posSpacing.md,
    minHeight: 200
  },
  image: { width: "100%", height: 88, borderRadius: posRadius.sm, marginBottom: posSpacing.sm },
  imagePlaceholder: {
    width: "100%",
    height: 88,
    borderRadius: posRadius.sm,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: posSpacing.sm
  },
  name: { fontSize: 13, fontWeight: "800", color: posColors.text, minHeight: 36, lineHeight: 18 },
  category: { fontSize: 10, color: posColors.textDim, marginTop: 2, fontWeight: "600" },
  price: { fontSize: 16, fontWeight: "900", color: posColors.primary, marginTop: posSpacing.sm },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: posSpacing.md },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: posRadius.pill,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: posColors.border
  },
  qtyBtnOff: { opacity: 0.4 },
  qtyBtnAdd: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  qty: { fontSize: 15, fontWeight: "900", color: posColors.text, minWidth: 24, textAlign: "center" },
  favBtn: { position: "absolute", top: 8, right: 8, zIndex: 2 },
  bestBadge: { fontSize: 8, fontWeight: "800", color: posColors.warning, marginBottom: 4 },
  rating: { fontSize: 10, color: posColors.textSecondary, marginTop: 2 }
});
