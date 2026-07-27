import React, { memo, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
import type { MenuQuickFilter } from "./pos-types";
import { PosIcon } from "./pos-icons";
import { PosInput } from "./pos-ui";
import { posColors, posPanel, posRadius, posSpacing, posType } from "./pos-theme";

const CATEGORY_ICONS: Record<string, string> = {
  all: "◉",
  drink: "🥤",
  juice: "🍹",
  milk: "🥛",
  shake: "🥛",
  food: "🍔",
  dessert: "🍰",
  default: "🍽"
};

function iconForCategory(name: string) {
  const key = name.toLowerCase();
  if (key === "all") return CATEGORY_ICONS.all;
  for (const [k, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return CATEGORY_ICONS.default;
}

type Props = {
  categories: readonly string[];
  grouped: Record<string, unknown[]>;
  selectedCategory: string;
  onCategorySelect: (cat: string) => void;
  onQuickFilter: (f: MenuQuickFilter) => void;
  compact?: boolean;
};

export const CategorySidebar = memo(function CategorySidebar({
  categories,
  grouped,
  selectedCategory,
  onCategorySelect,
  onQuickFilter,
  compact
}: Props) {
  const [catSearch, setCatSearch] = useState("");
  const layout = useResponsiveLayout();
  const isHorizontal = layout.isPhone || compact;
  const pad = layout.padding;

  const visibleCategories = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return categories.filter((c) => c !== "all" && (!q || c.toLowerCase().includes(q)));
  }, [categories, catSearch]);

  const totalCount = useMemo(() => Object.values(grouped).flat().length, [grouped]);

  const renderChip = (cat: string, label: string, count?: number, icon?: string) => {
    const active = selectedCategory === cat;
    return (
      <Pressable
        key={cat}
        onPress={() => {
          onQuickFilter("all");
          onCategorySelect(cat);
        }}
        style={[
          isHorizontal ? styles.chip : styles.catRow,
          active && (isHorizontal ? styles.chipOn : styles.catRowOn),
          {
            minHeight: layout.isTablet ? Math.max(layout.minTouch, 56) : layout.minTouch,
            borderRadius: layout.radius
          }
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.catIcon, layout.isTablet && styles.catIconTablet]}>
          {icon ?? iconForCategory(cat)}
        </Text>
        <Text
          style={[
            isHorizontal ? styles.chipLabel : styles.catLabel,
            layout.isTablet && !isHorizontal && styles.catLabelTablet,
            active && styles.catLabelOn
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {!isHorizontal && count !== undefined ? (
          <Text style={[styles.catCount, active && styles.catCountOn]}>{count}</Text>
        ) : null}
        {!isHorizontal && active ? <View style={styles.activeBar} /> : null}
      </Pressable>
    );
  };

  if (isHorizontal) {
    return (
      <View style={[styles.horizontalWrap, { paddingHorizontal: pad }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {renderChip("all", "All", totalCount, CATEGORY_ICONS.all)}
          {visibleCategories.map((cat) => renderChip(cat, cat, grouped[cat]?.length ?? 0))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[posPanel(), styles.sidebar]}>
      <View style={[styles.header, { paddingHorizontal: pad, paddingVertical: pad }]}>
        <Text style={[posType.h2, styles.sectionTitle]}>Categories</Text>
        <View style={[styles.searchWrap, { minHeight: layout.buttonHeight }]}>
          <PosIcon name="search" size={18} color={posColors.textDim} />
          <PosInput
            value={catSearch}
            onChangeText={setCatSearch}
            placeholder="Search category…"
            style={styles.search}
          />
          {catSearch ? (
            <Pressable onPress={() => setCatSearch("")} hitSlop={8} accessibilityLabel="Clear">
              <Text style={styles.clearX}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: pad * 0.5, paddingTop: posSpacing.sm }}>
        {renderChip("all", "All Items", totalCount, CATEGORY_ICONS.all)}
      </View>

      <FlatList
        data={visibleCategories}
        keyExtractor={(c) => c}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingHorizontal: pad * 0.5, paddingBottom: pad * 2 }]}
        renderItem={({ item: cat }) => renderChip(cat, cat, grouped[cat]?.length ?? 0)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  horizontalWrap: {
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    backgroundColor: posColors.secondary,
    maxHeight: 80
  },
  chipRow: {
    paddingVertical: posSpacing.sm,
    gap: posSpacing.sm,
    alignItems: "center"
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: posRadius.pill,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.card
  },
  chipOn: {
    backgroundColor: posColors.primaryMuted,
    borderColor: "rgba(79,140,255,0.45)"
  },
  chipLabel: { fontSize: 14, fontWeight: "700", color: posColors.textSecondary, flexShrink: 1 },
  sidebar: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    borderRightWidth: 0
  },
  header: { borderBottomWidth: 1, borderBottomColor: posColors.border, gap: posSpacing.md },
  sectionTitle: { fontSize: 18, color: posColors.text },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    backgroundColor: posColors.card,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.borderStrong,
    paddingHorizontal: posSpacing.md
  },
  search: { flex: 1, paddingVertical: 10, fontSize: 14, borderWidth: 0, backgroundColor: "transparent" },
  clearX: { color: posColors.textDim, fontSize: 14, fontWeight: "700", padding: 4 },
  list: { paddingTop: posSpacing.xs, gap: 4 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative",
    marginBottom: 2
  },
  catRowOn: {
    backgroundColor: posColors.primaryMuted,
    borderColor: "rgba(79,140,255,0.35)"
  },
  catIcon: { fontSize: 18, width: 28, textAlign: "center" },
  catIconTablet: { fontSize: 20, width: 32 },
  catLabel: { fontSize: 15, fontWeight: "700", color: posColors.textSecondary, flex: 1 },
  catLabelTablet: { fontSize: 16 },
  catLabelOn: { color: posColors.primary },
  catCount: {
    fontSize: 12,
    color: posColors.textDim,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "right"
  },
  catCountOn: { color: posColors.primary },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 2,
    backgroundColor: posColors.primary
  }
});
