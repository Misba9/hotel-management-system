import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { KitchenStage } from "../../src/lib/kitchen-order-mapper";
import type { KitchenNavCounts } from "../../src/hooks/use-kitchen-nav-counts";
import { useResponsiveLayout } from "../../src/hooks/use-responsive-layout";

export type KitchenNavTab = KitchenStage | "profile";

type Props = {
  stage: KitchenNavTab;
  counts: KitchenNavCounts;
  onStageChange: (stage: KitchenNavTab) => void;
};

const TABS: Array<{
  id: KitchenNavTab;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  countKey?: keyof KitchenNavCounts;
}> = [
  { id: "active", label: "Orders", icon: "receipt", countKey: "active" },
  { id: "ready", label: "Ready", icon: "check-circle", countKey: "ready" },
  { id: "history", label: "History", icon: "history" },
  { id: "profile", label: "Profile", icon: "person" }
];

function NavTab({
  tab,
  active,
  count,
  onPress,
  iconSize,
  labelSize
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  count: number | null;
  onPress: () => void;
  iconSize: number;
  labelSize: number;
}) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.96)).current;
  const pill = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: active ? 1 : 0.96,
        useNativeDriver: true,
        friction: 7,
        tension: 140
      }),
      Animated.timing(pill, {
        toValue: active ? 1 : 0,
        duration: 180,
        useNativeDriver: true
      })
    ]).start();
  }, [active, pill, scale]);

  const pillOpacity = pill;
  const pillScale = pill.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1]
  });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
      onPress={onPress}
      style={styles.tabHit}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activePill,
            {
              opacity: pillOpacity,
              transform: [{ scale: pillScale }]
            }
          ]}
        />
        <MaterialIcons name={tab.icon} size={iconSize} color={active ? "#fff" : "#94a3b8"} />
        <Text style={[styles.tabLabel, { fontSize: labelSize }, active && styles.tabLabelActive]} numberOfLines={1}>
          {tab.label}
        </Text>
        {count != null && count > 0 ? (
          <View style={[styles.badge, active && styles.badgeActive]}>
            <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function KitchenBottomNav({ stage, counts, onStageChange }: Props) {
  const insets = useSafeAreaInsets();
  const { isTablet, isLargeTablet, padding } = useResponsiveLayout();
  const bottomPad = Math.max(insets.bottom, 10);
  const sideInset = isLargeTablet ? Math.max(padding, 24) : isTablet ? 16 : 12;
  const barHeight = isTablet ? 80 : 74;
  const iconSize = isLargeTablet ? 26 : isTablet ? 24 : 22;
  const labelSize = isTablet ? 12 : 11;

  return (
    <View
      style={[styles.wrap, { left: sideInset, right: sideInset, paddingBottom: bottomPad }]}
      pointerEvents="box-none"
    >
      <View style={[styles.bar, { minHeight: barHeight, maxHeight: barHeight + 6 }]} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const count = tab.countKey ? counts[tab.countKey] : null;
          return (
            <NavTab
              key={tab.id}
              tab={tab}
              active={stage === tab.id}
              count={count}
              onPress={() => onStageChange(tab.id)}
              iconSize={iconSize}
              labelSize={labelSize}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 0,
    zIndex: 40,
    width: undefined,
    alignSelf: "stretch"
  },
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    paddingHorizontal: 6,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16
  },
  tabHit: {
    flex: 1,
    minWidth: 0
  },
  tabInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 4,
    overflow: "hidden"
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ea580c",
    borderRadius: 16
  },
  tabLabel: {
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 0.2
  },
  tabLabelActive: {
    color: "#fff"
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeActive: {
    backgroundColor: "rgba(255,255,255,0.28)"
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#e2e8f0"
  },
  badgeTextActive: {
    color: "#fff"
  }
});
