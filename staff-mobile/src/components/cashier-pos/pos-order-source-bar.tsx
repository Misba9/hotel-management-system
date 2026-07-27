import React, { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
import type { PlatformTab } from "../../lib/pos/cashier-pos-store";
import type { OrderStatusFilter } from "../../lib/pos/order-source";
import { posColors, posRadius, posSpacing } from "./pos-theme";

type PlatformDef = {
  id: PlatformTab;
  label: string;
  emoji: string;
  color: string;
};

const PLATFORM_TABS: PlatformDef[] = [
  { id: "parcel", label: "Parcel", emoji: "🛍", color: posColors.parcel },
  { id: "swiggy", label: "Swiggy", emoji: "🛵", color: "#F97316" },
  { id: "zomato", label: "Zomato", emoji: "🍔", color: "#E23744" },
  { id: "online", label: "Online", emoji: "🌐", color: posColors.online },
  { id: "waiter", label: "Waiter", emoji: "👨", color: posColors.success }
];

type Props = {
  activePlatform: PlatformTab;
  platformCounts: Record<PlatformTab, number>;
  onPlatformChange: (p: PlatformTab) => void;
};

export const PosOrderSourceBar = memo(function PosOrderSourceBar({
  activePlatform,
  platformCounts,
  onPlatformChange
}: Props) {
  const layout = useResponsiveLayout();
  const useEqualWidth = layout.isTablet;
  const useTwoRowGrid = layout.isLargePhone && !layout.isLandscape;
  const tabMinH = layout.isTablet ? 36 : 40;
  const emojiSize = layout.isTablet ? 13 : 14;
  const labelSize = layout.isTablet ? 11 : 12;
  const hPad = Math.max(8, Math.round(layout.padding * 0.65));

  const tabs = PLATFORM_TABS.map((tab) => {
    const on = activePlatform === tab.id;
    const count = platformCounts[tab.id];
    return (
      <Pressable
        key={tab.id}
        onPress={() => onPlatformChange(tab.id)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={[
          styles.tab,
          on && styles.tabOn,
          on && { borderColor: tab.color },
          useEqualWidth && styles.tabEqual,
          useTwoRowGrid && styles.tabGrid,
          { minHeight: tabMinH }
        ]}
      >
        <Text style={[styles.emoji, { fontSize: emojiSize }]}>{tab.emoji}</Text>
        <Text style={[styles.label, { fontSize: labelSize }, on && { color: tab.color }]} numberOfLines={1}>
          {tab.label}
        </Text>
        <View style={[styles.countBadge, on && { backgroundColor: tab.color }]}>
          <Text style={[styles.countText, on && styles.countTextOn]}>{count}</Text>
        </View>
      </Pressable>
    );
  });

  if (useEqualWidth) {
    return (
      <View style={[styles.wrap, { paddingHorizontal: hPad }]}>
        <View style={styles.tabletRow}>{tabs}</View>
      </View>
    );
  }

  if (useTwoRowGrid) {
    return (
      <View style={[styles.wrap, { paddingHorizontal: hPad }]}>
        <View style={styles.twoRowGrid}>{tabs}</View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollRow, { paddingHorizontal: hPad }]}
      >
        {tabs}
      </ScrollView>
    </View>
  );
});

/** @deprecated Use platformFilter from cashier-pos-store */
export type QueueNavFilter = PlatformTab;

/** @deprecated */
export function queueFilterToSourceStatus(filter: PlatformTab): {
  source: import("./pos-types").OrderSourceKey;
  status: OrderStatusFilter;
} {
  const sourceMap: Record<PlatformTab, import("./pos-types").OrderSourceKey> = {
    parcel: "parcel",
    swiggy: "swiggy",
    zomato: "zomato",
    online: "online",
    waiter: "waiter"
  };
  return { source: sourceMap[filter], status: "all" };
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    backgroundColor: posColors.secondary,
    flexShrink: 0
  },
  scrollRow: {
    paddingVertical: 6,
    gap: 6,
    alignItems: "center"
  },
  tabletRow: {
    flexDirection: "row",
    paddingVertical: 6,
    gap: 6,
    alignItems: "stretch"
  },
  twoRowGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 6,
    gap: 6
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.card,
    flexShrink: 1,
    minWidth: 0
  },
  tabEqual: { flex: 1 },
  tabGrid: { flexBasis: "48%", flexGrow: 1 },
  tabOn: {
    backgroundColor: posColors.primaryMuted,
    borderWidth: 1.5
  },
  emoji: { lineHeight: 16 },
  label: {
    fontWeight: "700",
    color: posColors.textSecondary,
    letterSpacing: 0.1,
    flexShrink: 1
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    marginLeft: 1
  },
  countText: { fontSize: 9, fontWeight: "800", color: posColors.textDim },
  countTextOn: { color: "#fff" }
});
