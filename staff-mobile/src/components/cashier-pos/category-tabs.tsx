import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { staffColors } from "../../theme/staff-ui";

type Props = {
  categories: readonly string[];
  selected: string | "all";
  onSelect: (cat: string | "all") => void;
};

export function CategoryTabs({ categories, selected, onSelect }: Props) {
  return (
    <View style={{ paddingBottom: 10 }}>
      <FlatList
        horizontal
        data={[...categories]}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item: cat }) => {
          const active = selected === cat;
          const label = cat === "all" ? "All" : cat;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onSelect(cat === "all" ? "all" : cat)}
              style={{
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 9,
                backgroundColor: active ? staffColors.accent : staffColors.surface,
                borderWidth: active ? 0 : 1,
                borderColor: staffColors.border,
                shadowColor: active ? staffColors.accent : "transparent",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: active ? 0.25 : 0,
                shadowRadius: 6,
                elevation: active ? 3 : 0
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: 13, color: active ? "white" : staffColors.text }}>{label}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
