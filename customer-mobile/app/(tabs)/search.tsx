import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Input } from "@/src/components/ui/input";
import { ProductCard } from "@/src/components/product/product-card";
import { ProductCardSkeleton } from "@/src/components/ui/skeleton";
import { useMenu } from "@/src/hooks/use-menu";

export default function SearchScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { products, loading } = useMenu();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.filter((p) => p.available).slice(0, 12);
    return products.filter(
      (p) =>
        p.available &&
        (p.name.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q))
    );
  }, [products, query]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Search</Text>
        <Input
          placeholder="Search fruits, juices…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          style={{ marginBottom: 0 }}
        />
      </View>

      {loading ? (
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.gridItem}>
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No results for "{query}"</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "900", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10 },
  gridItem: { width: "50%" },
  list: { paddingHorizontal: 10, paddingBottom: 24 },
  empty: { textAlign: "center", padding: 40, fontSize: 15 }
});
