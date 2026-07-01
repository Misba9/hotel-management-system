import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, showBack = true, right }: Props) {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.right}>{right ?? <View style={styles.backBtn} />}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12, paddingHorizontal: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 18, fontWeight: "800", textAlign: "center" },
  right: { width: 40, alignItems: "flex-end" }
});
