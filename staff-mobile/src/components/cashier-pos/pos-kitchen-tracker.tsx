import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StaffOrderRow } from "../../../services/orders";
import { KITCHEN_STAGES, kitchenStageIndex, resolveKitchenStage } from "../../lib/pos/kitchen-stages";
import { posCard, posColors, posSpacing, posType } from "./pos-theme";

type Props = { order: StaffOrderRow | null };

export function PosKitchenTracker({ order }: Props) {
  if (!order) return null;
  const current = resolveKitchenStage(order);
  const idx = kitchenStageIndex(current);

  return (
    <View style={[posCard(), styles.wrap]}>
      <Text style={posType.label}>Kitchen Status</Text>
      <View style={styles.track}>
        {KITCHEN_STAGES.map((stage, i) => {
          const active = i <= idx;
          const currentStage = i === idx;
          return (
            <View key={stage.id} style={styles.step}>
              <View style={[styles.dot, active && { backgroundColor: stage.color }, currentStage && styles.dotCurrent]} />
              <Text style={[styles.label, active && { color: posColors.text }]} numberOfLines={1}>
                {stage.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: posSpacing.md, marginTop: posSpacing.sm },
  track: { flexDirection: "row", justifyContent: "space-between", marginTop: posSpacing.md, gap: 4 },
  step: { flex: 1, alignItems: "center", minWidth: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: posColors.border, marginBottom: 4 },
  dotCurrent: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#fff" },
  label: { fontSize: 8, fontWeight: "700", color: posColors.textDim, textAlign: "center" }
});
