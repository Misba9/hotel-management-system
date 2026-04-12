import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { staffColors } from "../../theme/staff-ui";
import { elevation, radius, space } from "../../theme/design-tokens";

type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export const StaffErrorView = React.memo(function StaffErrorView({ title = "Something went wrong", message, onRetry }: Props) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={styles.btn} accessibilityRole="button" accessibilityLabel="Retry">
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    ...elevation(2)
  },
  title: { fontSize: 16, fontWeight: "800", color: staffColors.danger },
  body: { marginTop: space.sm, color: "#991B1B", fontSize: 13, lineHeight: 18 },
  btn: {
    marginTop: space.md,
    alignSelf: "flex-start",
    backgroundColor: staffColors.accent,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.sm
  },
  btnText: { color: "white", fontWeight: "800" }
});
