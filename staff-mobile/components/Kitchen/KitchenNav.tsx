import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { KitchenStage } from "../../src/lib/kitchen-order-mapper";
import type { KitchenNavCounts } from "../../src/hooks/use-kitchen-nav-counts";

type Props = {
  stage: KitchenStage;
  counts: KitchenNavCounts;
  onStageChange: (stage: KitchenStage) => void;
};

const TABS: Array<{ id: KitchenStage; label: string; countKey?: keyof KitchenNavCounts }> = [
  { id: "active", label: "Orders", countKey: "active" },
  { id: "ready", label: "Ready", countKey: "ready" },
  { id: "history", label: "History" }
];

export function KitchenNav({ stage, counts, onStageChange }: Props) {
  return (
    <View style={styles.nav} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const count = tab.countKey ? counts[tab.countKey] : null;
        const active = stage === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onStageChange(tab.id)}
            style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            {count != null && count > 0 ? (
              <View style={[styles.badge, active && styles.badgeActive]}>
                <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155"
  },
  tabActive: {
    backgroundColor: "#ea580c",
    borderColor: "#fb923c"
  },
  tabPressed: { opacity: 0.9 },
  tabLabel: { fontSize: 14, fontWeight: "700", color: "#94a3b8" },
  tabLabelActive: { color: "#fff" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.22)" },
  badgeText: { fontSize: 12, fontWeight: "800", color: "#e2e8f0" },
  badgeTextActive: { color: "#fff" }
});
