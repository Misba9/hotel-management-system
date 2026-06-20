import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
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

export function CategorySidebar({
  categories,
  grouped,
  selectedCategory,
  onCategorySelect,
  onQuickFilter,
  compact
}: Props) {
  const [catSearch, setCatSearch] = useState("");

  const visibleCategories = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return categories.filter((c) => c !== "all" && (!q || c.toLowerCase().includes(q)));
  }, [categories, catSearch]);

  const totalCount = useMemo(() => Object.values(grouped).flat().length, [grouped]);

  return (
    <View style={[posPanel(), styles.sidebar, compact && styles.compact]}>
      <View style={styles.header}>
        <Text style={posType.label}>Categories</Text>
        {!compact ? (
          <View style={styles.searchWrap}>
            <PosIcon name="search" size={14} color={posColors.textDim} />
            <PosInput
              value={catSearch}
              onChangeText={setCatSearch}
              placeholder="Search category…"
              style={styles.search}
            />
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => {
          onCategorySelect("all");
          onQuickFilter("all");
        }}
        style={[styles.catRow, selectedCategory === "all" && styles.catRowOn]}
      >
        <Text style={styles.catIcon}>◉</Text>
        <View style={styles.catTextWrap}>
          <Text style={[styles.catLabel, selectedCategory === "all" && styles.catLabelOn]}>All Items</Text>
          {!compact ? <Text style={styles.catCount}>({totalCount})</Text> : null}
        </View>
      </Pressable>

      <FlatList
        data={visibleCategories}
        keyExtractor={(c) => c}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: cat }) => {
          const active = selectedCategory === cat;
          const count = grouped[cat]?.length ?? 0;
          return (
            <Pressable
              onPress={() => {
                onQuickFilter("all");
                onCategorySelect(cat);
              }}
              style={({ pressed }) => [
                styles.catRow,
                active && styles.catRowOn,
                pressed && styles.catRowPressed
              ]}
            >
              <Text style={styles.catIcon}>{iconForCategory(cat)}</Text>
              <View style={styles.catTextWrap}>
                <Text style={[styles.catLabel, active && styles.catLabelOn]} numberOfLines={1}>
                  {cat}
                </Text>
                {!compact ? <Text style={styles.catCount}>({count})</Text> : null}
              </View>
              {active ? <View style={styles.activeBar} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 210,
    minWidth: 190,
    maxWidth: 230,
    borderRightWidth: 1
  },
  compact: { width: "100%", maxWidth: "100%", minWidth: 0, borderRightWidth: 0, maxHeight: 120 },
  header: { padding: posSpacing.md, borderBottomWidth: 1, borderBottomColor: posColors.border, gap: posSpacing.sm },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: posSpacing.xs },
  search: { flex: 1, paddingVertical: 8, fontSize: 12 },
  list: { padding: posSpacing.sm, paddingBottom: posSpacing.xxl, gap: 2 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative"
  },
  catRowOn: {
    backgroundColor: posColors.primaryMuted,
    borderColor: "rgba(255,122,0,0.25)"
  },
  catRowPressed: { opacity: 0.85 },
  catIcon: { fontSize: 16, width: 22, textAlign: "center" },
  catTextWrap: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 4 },
  catLabel: { fontSize: 13, fontWeight: "700", color: posColors.textSecondary },
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
