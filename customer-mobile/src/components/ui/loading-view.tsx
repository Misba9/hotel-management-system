import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type Props = { message?: string };

export function LoadingView({ message = "Loading…" }: Props) {
  const colors = useThemeColors();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  text: { fontSize: 14 }
});
