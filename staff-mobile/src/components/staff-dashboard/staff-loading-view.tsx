import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { staffColors } from "../../theme/staff-ui";
import { space } from "../../theme/design-tokens";

type Props = {
  message?: string;
};

export const StaffLoadingView = React.memo(function StaffLoadingView({ message = "Loading…" }: Props) {
  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={staffColors.accent} />
      <Text style={styles.msg}>{message}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space.xxl,
    backgroundColor: staffColors.bg
  },
  msg: {
    marginTop: space.md,
    color: staffColors.muted,
    fontSize: 14,
    fontWeight: "600"
  }
});
