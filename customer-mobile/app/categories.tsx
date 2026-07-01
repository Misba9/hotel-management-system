import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { useMenu } from "@/src/hooks/use-menu";

export default function CategoriesScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { categories, products } = useMenu();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Categories" />
      <FlatList
        data={categories.filter((c) => c.id !== "all")}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push("/(tabs)/home")}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.name, { color: colors.textPrimary }]}>{item.name}</Text>
            <Text style={{ color: colors.textSecondary }}>{item.count} items</Text>
          </Pressable>
        )}
        ListHeaderComponent={
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {products.filter((p) => p.available).length} products available
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { padding: 16 },
  hint: { marginBottom: 16, fontSize: 14 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 10 },
  name: { fontSize: 17, fontWeight: "800" }
});
