import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { staffColors } from "../../theme/staff-ui";
import { elevation, radius, space } from "../../theme/design-tokens";

type Props = {
  icon?: string;
  title: string;
  subtitle?: string;
};

export const EmptyState = React.memo(function EmptyState({ icon = "📭", title, subtitle }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={styles.card}>
        <Text style={styles.icon} accessibilityLabel="">
          {icon}
        </Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg
  },
  card: {
    alignItems: "center",
    maxWidth: 320,
    width: "100%",
    backgroundColor: staffColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: staffColors.border,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    ...elevation(2)
  },
  icon: {
    fontSize: 40,
    marginBottom: space.md
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: staffColors.text,
    textAlign: "center",
    letterSpacing: -0.2
  },
  subtitle: {
    marginTop: space.sm,
    fontSize: 14,
    color: staffColors.muted,
    textAlign: "center",
    lineHeight: 20
  }
});
