import React, { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
import type { PlatformTab } from "../../lib/pos/cashier-pos-store";
import type { OrderStatusFilter } from "../../lib/pos/order-source";
import { posCard, posColors, posRadius, posSpacing } from "./pos-theme";

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
          posCard(),
          on && styles.tabOn,
          on && { borderColor: tab.color },
          useEqualWidth && styles.tabEqual,
          useTwoRowGrid && styles.tabGrid,
          { minHeight: layout.minTouch, borderRadius: layout.radius }
        ]}
      >
        <Text style={[styles.emoji, { fontSize: layout.moderateScale(16) }]}>{tab.emoji}</Text>
        <Text style={[styles.label, { fontSize: layout.moderateScale(12) }, on && { color: tab.color }]}>
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
      <View style={[styles.wrap, { paddingHorizontal: layout.padding }]}>
        <View style={styles.tabletRow}>{tabs}</View>
      </View>
    );
  }

  if (useTwoRowGrid) {
    return (
      <View style={[styles.wrap, { paddingHorizontal: layout.padding }]}>
        <View style={styles.twoRowGrid}>{tabs}</View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollRow, { paddingHorizontal: layout.padding }]}
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
    backgroundColor: posColors.secondary
  },
  scrollRow: {
    paddingVertical: posSpacing.sm,
    gap: posSpacing.sm,
    alignItems: "center"
  },
  tabletRow: {
    flexDirection: "row",
    paddingVertical: posSpacing.sm,
    gap: posSpacing.sm,
    alignItems: "stretch"
  },
  twoRowGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: posSpacing.sm,
    gap: posSpacing.sm
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: posRadius.lg,
    borderWidth: 1,
    borderColor: posColors.border,
    flexShrink: 0
  },
  tabEqual: { flex: 1, justifyContent: "center" },
  tabGrid: { flexBasis: "48%", flexGrow: 1, justifyContent: "center" },
  tabOn: {
    backgroundColor: posColors.primaryMuted,
    borderWidth: 1.5
  },
  emoji: {},
  label: {
    fontWeight: "800",
    color: posColors.textSecondary,
    letterSpacing: 0.2
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 2
  },
  countText: { fontSize: 10, fontWeight: "900", color: posColors.textDim },
  countTextOn: { color: "#fff" }
});
