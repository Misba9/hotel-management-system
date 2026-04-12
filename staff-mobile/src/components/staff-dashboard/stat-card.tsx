import React from "react";
import { Text, View } from "react-native";
import { cardShadow, staffColors } from "../../theme/staff-ui";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
};

export function StatCard({ label, value, hint, accent = staffColors.accent }: Props) {
  return (
    <View
      style={[
        {
          flex: 1,
          minWidth: 148,
          borderRadius: 16,
          padding: 14,
          backgroundColor: staffColors.surface,
          borderWidth: 1,
          borderColor: staffColors.border
        },
        cardShadow()
      ]}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: staffColors.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ marginTop: 6, fontSize: 22, fontWeight: "900", color: accent }}>{value}</Text>
      {hint ? <Text style={{ marginTop: 4, fontSize: 11, color: staffColors.muted }}>{hint}</Text> : null}
    </View>
  );
}
