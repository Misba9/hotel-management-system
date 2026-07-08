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

  const visibleCategories = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return categories.filter((c) => c !== "all" && (!q || c.toLowerCase().includes(q)));
  }, [categories, catSearch]);

  const totalCount = useMemo(() => Object.values(grouped).flat().length, [grouped]);
  const sidebarWidth =
    typeof layout.categorySidebarWidth === "number" ? layout.categorySidebarWidth : undefined;

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
          { minHeight: layout.minTouch, borderRadius: layout.radius }
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={styles.catIcon}>{icon ?? iconForCategory(cat)}</Text>
        <Text
          style={[isHorizontal ? styles.chipLabel : styles.catLabel, active && styles.catLabelOn]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {!isHorizontal && count !== undefined ? <Text style={styles.catCount}>({count})</Text> : null}
        {!isHorizontal && active ? <View style={styles.activeBar} /> : null}
      </Pressable>
    );
  };

  if (isHorizontal) {
    return (
      <View style={[styles.horizontalWrap, { paddingHorizontal: layout.padding }]}>
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
    <View
      style={[
        posPanel(),
        styles.sidebar,
        sidebarWidth !== undefined ? { width: sidebarWidth, minWidth: sidebarWidth * 0.85, maxWidth: sidebarWidth * 1.1 } : null
      ]}
    >
      <View style={[styles.header, { padding: layout.padding }]}>
        <Text style={[posType.label, { fontSize: layout.moderateScale(10) }]}>Categories</Text>
        <View style={styles.searchWrap}>
          <PosIcon name="search" size={layout.moderateScale(14)} color={posColors.textDim} />
          <PosInput
            value={catSearch}
            onChangeText={setCatSearch}
            placeholder="Search category…"
            style={[styles.search, { fontSize: layout.moderateScale(12) }]}
          />
        </View>
      </View>

      {renderChip("all", "All Items", totalCount, CATEGORY_ICONS.all)}

      <FlatList
        data={visibleCategories}
        keyExtractor={(c) => c}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { padding: layout.padding * 0.5 }]}
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
    maxHeight: 72
  },
  chipRow: {
    paddingVertical: posSpacing.sm,
    gap: posSpacing.sm,
    alignItems: "center"
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: posRadius.pill,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.card
  },
  chipOn: {
    backgroundColor: posColors.primaryMuted,
    borderColor: "rgba(255,122,0,0.35)"
  },
  chipLabel: { fontSize: 13, fontWeight: "700", color: posColors.textSecondary, maxWidth: 120 },
  sidebar: {
    borderRightWidth: 1,
    flexShrink: 0
  },
  header: { borderBottomWidth: 1, borderBottomColor: posColors.border, gap: posSpacing.sm },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: posSpacing.xs },
  search: { flex: 1, paddingVertical: 8 },
  list: { paddingBottom: posSpacing.xxl, gap: 2 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative",
    marginHorizontal: posSpacing.xs
  },
  catRowOn: {
    backgroundColor: posColors.primaryMuted,
    borderColor: "rgba(255,122,0,0.25)"
  },
  catIcon: { fontSize: 16, width: 22, textAlign: "center" },
  catLabel: { fontSize: 13, fontWeight: "700", color: posColors.textSecondary, flex: 1 },
  catLabelOn: { color: posColors.primary },
  catCount: { fontSize: 11, color: posColors.textDim, fontWeight: "600" },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: posColors.primary
  }
});
