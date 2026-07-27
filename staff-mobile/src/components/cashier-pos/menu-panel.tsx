import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type TextInput
} from "react-native";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
import type { CartLine, MenuItemDoc, MenuQuickFilter } from "./pos-types";
import { ProductCard } from "./product-card";
import { ResponsiveSearchBar } from "./responsive/ResponsiveSearchBar";
import { PosEmpty } from "./pos-ui";
import { posColors, posPanel, posSpacing } from "./pos-theme";

const GRID_GAP = 12;

type Props = {
  products: MenuItemDoc[];
  grouped: Record<string, MenuItemDoc[]>;
  categories: readonly string[];
  selectedCategory: string;
  quickFilter?: MenuQuickFilter;
  search: string;
  cartQtyById: Record<string, number>;
  recentProductIds: string[];
  loading: boolean;
  error: string | null;
  onCategorySelect: (cat: string) => void;
  onQuickFilter?: (f: MenuQuickFilter) => void;
  onSearchChange: (v: string) => void;
  onAdd: (item: MenuItemDoc) => void;
  onDec: (item: MenuItemDoc) => void;
  onAddCombo: (lines: CartLine[]) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  searchInputRef?: React.Ref<TextInput>;
  showCategoryTabs?: boolean;
  numColumns?: number;
  onBarcodeScan?: () => void;
  onQuickDiscount?: () => void;
  headerAction?: React.ReactNode;
  orderToolbar?: React.ReactNode;
};

function AnimatedProductCell({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, delay: Math.min(index * 20, 120), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 180, delay: Math.min(index * 20, 120), useNativeDriver: true })
    ]).start();
  }, [index, opacity, scale]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }], flex: 1 }}>
      {children}
    </Animated.View>
  );
}

export function MenuPanel({
  products,
  grouped,
  selectedCategory,
  search,
  cartQtyById,
  loading,
  error,
  onSearchChange,
  onAdd,
  onDec,
  favoriteIds,
  onToggleFavorite,
  searchInputRef,
  onBarcodeScan,
  headerAction
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const layout = useResponsiveLayout();
  const numColumns = layout.productColumns;
  const pad = layout.padding;

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list =
      selectedCategory === "all"
        ? products.filter((p) => p.available !== false)
        : (grouped[selectedCategory] ?? []).filter((p) => p.available !== false);

    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
    return list;
  }, [products, grouped, selectedCategory, search]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => p.name);
  }, [products, search]);

  const renderItem = useCallback(
    ({ item, index }: { item: MenuItemDoc; index: number }) => (
      <View style={numColumns > 1 ? styles.gridCell : styles.gridCellSingle}>
        <AnimatedProductCell index={index}>
          <ProductCard
            item={item}
            qty={cartQtyById[item.id] ?? 0}
            isFavorite={favoriteIds.has(item.id)}
            isBestSeller={item.isBestSeller ?? item.name.length % 5 === 0}
            onAdd={() => onAdd(item)}
            onDec={() => onDec(item)}
            onToggleFavorite={() => onToggleFavorite(item.id)}
          />
        </AnimatedProductCell>
      </View>
    ),
    [cartQtyById, favoriteIds, numColumns, onAdd, onDec, onToggleFavorite]
  );

  const keyExtractor = useCallback((item: MenuItemDoc) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={[posPanel(), styles.panel]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={layout.isTablet ? 0 : 80}
    >
      <ResponsiveSearchBar
        search={search}
        onSearchChange={(v) => {
          onSearchChange(v);
          setShowSuggestions(v.trim().length >= 2);
        }}
        onBarcodeScan={onBarcodeScan}
        searchInputRef={searchInputRef}
        headerAction={headerAction}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        onSuggestionSelect={(name) => {
          onSearchChange(name);
          setShowSuggestions(false);
        }}
        onFocus={() => setShowSuggestions(search.trim().length >= 2)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={posColors.primary} size="large" />
        </View>
      ) : error ? (
        <PosEmpty message="Menu unavailable" hint={error} />
      ) : visibleProducts.length === 0 ? (
        <PosEmpty message="No products found" hint="Try another category or search" />
      ) : (
        <FlatList
          key={`grid-${numColumns}`}
          data={visibleProducts}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          renderItem={renderItem}
          style={styles.gridList}
          contentContainerStyle={[styles.gridContent, { padding: pad, gap: GRID_GAP }]}
          columnWrapperStyle={numColumns > 1 ? { gap: GRID_GAP } : undefined}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={numColumns * 4}
          maxToRenderPerBatch={numColumns * 3}
          windowSize={7}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: { borderRightWidth: 0, flex: 1, minHeight: 0, width: "100%" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  gridList: { flex: 1, minHeight: 0 },
  gridContent: { paddingBottom: posSpacing.huge },
  gridCell: { flex: 1, minWidth: 0 },
  gridCellSingle: { width: "100%" }
});
