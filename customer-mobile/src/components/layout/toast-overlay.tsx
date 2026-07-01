import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { StyleSheet, Text, View } from "react-native";
import { useToast } from "@/src/context/toast-context";

export function ToastOverlay() {
  const { current } = useToast();
  const colors = useThemeColors();

  if (!current) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{current.title}</Text>
        {current.description ? (
          <Text style={[styles.desc, { color: colors.textSecondary }]}>{current.description}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 999,
    alignItems: "center"
  },
  pill: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: 400,
    width: "100%"
  },
  title: { fontWeight: "700", fontSize: 14 },
  desc: { fontSize: 12, marginTop: 4 }
});
