import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextInput,
  type ViewStyle
} from "react-native";
import type { CartLine, MenuItemDoc, MenuQuickFilter } from "./pos-types";
import { PosComboSection } from "./pos-combo-section";
import { ProductCard } from "./product-card";
import { PosIcon } from "./pos-icons";
import { PosEmpty, PosInput } from "./pos-ui";
import { posColors, posPanel, posRadius, posSpacing, posType } from "./pos-theme";

const GRID_GAP = 16;

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
  showCategoryTabs?: boolean;
  numColumns?: number;
  onBarcodeScan?: () => void;
  onQuickDiscount?: () => void;
  headerAction?: React.ReactNode;
  orderToolbar?: React.ReactNode;
};

function useProductCardMetrics(containerWidth: number, windowWidth: number) {
  return useMemo(() => {
    const isMobile = windowWidth < 768;
    const isTablet = windowWidth >= 768 && windowWidth < 1200;
    const cardHeight = isMobile ? 260 : isTablet ? 250 : 260;
    const horizontalPad = posSpacing.sm * 2;
    const innerWidth = Math.max(0, containerWidth - horizontalPad);

    if (isMobile) {
      const cardWidth = Math.max(160, innerWidth);
      return { cardWidth, cardHeight, isMobile: true as const };
    }

    const cardWidth = isTablet ? 220 : 240;
    return { cardWidth, cardHeight, isMobile: false as const };
  }, [containerWidth, windowWidth]);
}

function AnimatedProductCell({
  children,
  index
}: {
  children: React.ReactNode;
  index: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, delay: Math.min(index * 20, 120), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 180, delay: Math.min(index * 20, 120), useNativeDriver: true })
    ]).start();
  }, [index, opacity, scale]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}

export function MenuPanel({
  products,
  grouped,
  selectedCategory,
  quickFilter,
  search,
  cartQtyById,
  recentProductIds,
  loading,
  error,
  onSearchChange,
  onAdd,
  onDec,
  onAddCombo,
  favoriteIds,
  onToggleFavorite,
  searchInputRef,
  onBarcodeScan,
  onQuickDiscount,
  headerAction,
  orderToolbar
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const { cardWidth, cardHeight, isMobile } = useProductCardMetrics(gridWidth, windowWidth);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list =
      selectedCategory === "all"
        ? products.filter((p) => p.available !== false)
        : (grouped[selectedCategory] ?? []).filter((p) => p.available !== false);

    if (quickFilter === "favorites") list = list.filter((p) => favoriteIds.has(p.id));
    if (quickFilter === "popular") {
      list = [...list]
        .sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0) || b.price - a.price)
        .slice(0, 48);
    }
    if (quickFilter === "recent") {
      const set = new Set(recentProductIds);
      list = list.filter((p) => set.has(p.id));
      if (list.length === 0) list = products.slice(0, 8);
    }

    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
    return list;
  }, [products, grouped, selectedCategory, search, quickFilter, recentProductIds, favoriteIds]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => p.name);
  }, [products, search]);

  const gridStyle = useMemo((): ViewStyle => {
    if (Platform.OS === "web" && !isMobile && cardWidth > 0) {
      return {
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, ${cardWidth}px)`,
        gap: GRID_GAP,
        justifyContent: "start",
        padding: posSpacing.sm,
        paddingBottom: posSpacing.huge
      } as unknown as ViewStyle;
    }
    return {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GRID_GAP,
      justifyContent: "flex-start",
      alignContent: "flex-start",
      padding: posSpacing.sm,
      paddingBottom: posSpacing.huge
    };
  }, [cardWidth, isMobile]);

  const renderCard = useCallback(
    (item: MenuItemDoc, index: number) => (
      <AnimatedProductCell key={item.id} index={index}>
        <View style={{ width: cardWidth, height: cardHeight }}>
          <ProductCard
            item={item}
            width={cardWidth}
            height={cardHeight}
            qty={cartQtyById[item.id] ?? 0}
            isFavorite={favoriteIds.has(item.id)}
            isBestSeller={item.isBestSeller ?? item.name.length % 5 === 0}
            onAdd={() => onAdd(item)}
            onDec={() => onDec(item)}
            onToggleFavorite={() => onToggleFavorite(item.id)}
          />
        </View>
      </AnimatedProductCell>
    ),
    [cardWidth, cardHeight, cartQtyById, favoriteIds, onAdd, onDec, onToggleFavorite]
  );

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
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={[styles.searchWrap, { flex: 1 }]}>
            <PosIcon name="search" size={18} color={posColors.textDim} />
            <PosInput
              ref={searchInputRef}
              value={search}
              onChangeText={(v) => {
                onSearchChange(v);
                setShowSuggestions(v.trim().length >= 2);
              }}
              onFocus={() => setShowSuggestions(search.trim().length >= 2)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search product…  ( / )"
              style={styles.search}
            />
            <Pressable onPress={onBarcodeScan} style={styles.scanBtn}>
              <Text style={styles.scanText}>⌗</Text>
            </Pressable>
          </View>
          {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
        </View>
        {orderToolbar ? <View style={styles.orderToolbar}>{orderToolbar}</View> : null}
        {showSuggestions && suggestions.length > 0 ? (
          <View style={styles.suggestions}>
            {suggestions.map((name) => (
              <Pressable
                key={name}
                onPress={() => {
                  onSearchChange(name);
                  setShowSuggestions(false);
                }}
                style={styles.suggestionRow}
              >
                <PosIcon name="search" size={12} color={posColors.textDim} />
                <Text style={styles.suggestionText}>{name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.toolbar}>
        <Text style={posType.h3}>Products</Text>
        <Text style={posType.small}>{visibleProducts.length} items</Text>
        <Pressable onPress={onQuickDiscount} style={styles.discBtn}>
          <Text style={styles.discText}>F6 Discount</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={posColors.primary} size="large" />
        </View>
      ) : error ? (
        <PosEmpty message="Menu unavailable" hint={error} />
      ) : visibleProducts.length === 0 ? (
        <PosEmpty message="No products found" hint="Try another category or search" />
      ) : (
        <ScrollView
          style={styles.gridScroll}
          contentContainerStyle={gridStyle}
          showsVerticalScrollIndicator
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
        >
          {visibleProducts.map((item, index) => renderCard(item, index))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRightWidth: 0 },
  header: { padding: posSpacing.lg, borderBottomWidth: 1, borderBottomColor: posColors.border },
  searchSection: {
    paddingHorizontal: posSpacing.lg,
    paddingTop: posSpacing.md,
    paddingBottom: posSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    zIndex: 10
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm
  },
  headerAction: { flexShrink: 0 },
  orderToolbar: { paddingTop: posSpacing.sm, alignItems: "flex-end" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    backgroundColor: posColors.card,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.borderStrong,
    paddingHorizontal: posSpacing.md,
    minHeight: 48
  },
  search: { flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingVertical: 12, fontSize: 15 },
  scanBtn: {
    width: 36,
    height: 36,
    borderRadius: posRadius.sm,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: posColors.border
  },
  scanText: { fontSize: 16, fontWeight: "800", color: posColors.textSecondary },
  suggestions: {
    marginTop: posSpacing.xs,
    backgroundColor: posColors.card,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    overflow: "hidden"
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    paddingHorizontal: posSpacing.md,
    paddingVertical: posSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border
  },
  suggestionText: { fontSize: 13, fontWeight: "600", color: posColors.text },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    paddingHorizontal: posSpacing.lg,
    paddingVertical: posSpacing.sm
  },
  discBtn: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: posRadius.sm,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.card
  },
  discText: { fontSize: 10, fontWeight: "800", color: posColors.warning },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  gridScroll: { flex: 1, minHeight: 0 }
});
