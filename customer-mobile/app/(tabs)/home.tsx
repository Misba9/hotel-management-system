import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ProductCard } from "@/src/components/product/product-card";
import { ProductCardSkeleton } from "@/src/components/ui/skeleton";
import { useMenu } from "@/src/hooks/use-menu";

export default function HomeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { products, categories, loading, error } = useMenu();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    if (selectedCategory === "all") return products.filter((p) => p.available);
    const cat = categories.find((c) => c.id === selectedCategory);
    if (!cat) return products.filter((p) => p.available);
    return products.filter((p) => p.available && (p.categoryName === cat.name || p.categoryId === cat.id));
  }, [products, categories, selectedCategory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Good day 👋</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Fresh & Healthy</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/notifications")} style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => router.push("/wishlist")} style={styles.iconBtn}>
            <Ionicons name="heart-outline" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catContent}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setSelectedCategory(cat.id)}
            style={[
              styles.catPill,
              {
                backgroundColor: selectedCategory === cat.id ? colors.primary : colors.surface,
                borderColor: colors.border
              }
            ]}
          >
            <Text
              style={{
                color: selectedCategory === cat.id ? "#fff" : colors.textPrimary,
                fontWeight: "600",
                fontSize: 13
              }}
            >
              {cat.name}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => router.push("/categories")}
          style={[styles.catPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>See all</Text>
        </Pressable>
      </ScrollView>

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : loading ? (
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.gridItem}>
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No products in this category</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  greeting: { fontSize: 13 },
  title: { fontSize: 24, fontWeight: "900", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 8 },
  catScroll: { maxHeight: 48, marginBottom: 8 },
  catContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  catPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10 },
  gridItem: { width: "50%" },
  list: { paddingHorizontal: 10, paddingBottom: 24 },
  error: { padding: 20, textAlign: "center" },
  empty: { textAlign: "center", padding: 40, fontSize: 15 }
});
