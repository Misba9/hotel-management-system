import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { PosInput } from "./pos-ui";
import { posColors, posPanel, posRadius, posSpacing, posType } from "./pos-theme";

const CATEGORY_ICONS: Record<string, string> = {
  all: "◉",
  drinks: "🥤",
  beverage: "🥤",
  juice: "🍹",
  fast: "🍔",
  chinese: "🥡",
  dessert: "🍰",
  special: "⭐",
  combo: "⊕",
  default: "🍽"
};

function iconForCategory(name: string) {
  const key = name.toLowerCase();
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
  compact?: boolean;
};

export function CategorySidebar({ categories, grouped, selectedCategory, onCategorySelect, compact }: Props) {
  const [catSearch, setCatSearch] = useState("");

  const visibleCategories = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return categories.filter((c) => !q || c.toLowerCase().includes(q));
  }, [categories, catSearch]);

  return (
    <View style={[posPanel(), styles.sidebar, compact && styles.compact]}>
      <View style={styles.header}>
        <Text style={posType.label}>Categories</Text>
        {!compact ? (
          <PosInput value={catSearch} onChangeText={setCatSearch} placeholder="Search…" style={styles.search} />
        ) : null}
      </View>

      <FlatList
        data={visibleCategories}
        keyExtractor={(c) => c}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: cat }) => {
          const active = selectedCategory === cat;
          const count = cat === "all" ? Object.values(grouped).flat().length : (grouped[cat]?.length ?? 0);
          const label = cat === "all" ? "All Items" : cat;
          return (
            <Pressable
              onPress={() => onCategorySelect(cat)}
              style={({ pressed }) => [styles.catRow, active && styles.catRowOn, pressed && styles.catRowPressed]}
            >
              <Text style={styles.catIcon}>{iconForCategory(label)}</Text>
              <View style={styles.catTextWrap}>
                <Text style={[styles.catLabel, active && styles.catLabelOn]} numberOfLines={1}>
                  {label}
                </Text>
                {!compact ? <Text style={styles.catCount}>{count} items</Text> : null}
              </View>
              <View style={[styles.countBadge, active && styles.countBadgeOn]}>
                <Text style={[styles.countText, active && styles.countTextOn]}>{count}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 200,
    minWidth: 180,
    maxWidth: 220,
    borderRightWidth: 1
  },
  compact: { width: "100%", maxWidth: "100%", minWidth: 0, borderRightWidth: 0, maxHeight: 120 },
  header: { padding: posSpacing.md, borderBottomWidth: 1, borderBottomColor: posColors.border, gap: posSpacing.sm },
  search: { paddingVertical: 8 },
  list: { padding: posSpacing.sm, paddingBottom: posSpacing.xxl, gap: 2 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: "transparent"
  },
  catRowOn: { backgroundColor: posColors.primaryMuted, borderColor: "rgba(255,122,0,0.2)" },
  catRowPressed: { opacity: 0.85 },
  catIcon: { fontSize: 16, width: 22, textAlign: "center" },
  catTextWrap: { flex: 1, minWidth: 0 },
  catLabel: { fontSize: 13, fontWeight: "700", color: posColors.textSecondary },
  catLabelOn: { color: posColors.primary },
  catCount: { fontSize: 10, color: posColors.textDim, marginTop: 1 },
  countBadge: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: posRadius.pill,
    backgroundColor: posColors.bg,
    alignItems: "center"
  },
  countBadgeOn: { backgroundColor: posColors.primary },
  countText: { fontSize: 10, fontWeight: "800", color: posColors.textDim },
  countTextOn: { color: "#fff" }
});
