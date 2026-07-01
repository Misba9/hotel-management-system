import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { ProductCard } from "@/src/components/product/product-card";
import { useFavorites } from "@/src/context/favorites-context";
import { useMenu } from "@/src/hooks/use-menu";

export default function WishlistScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { favorites } = useFavorites();
  const { products } = useMenu();

  const wishlistProducts = products.filter((p) => favorites.includes(p.id));

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Wishlist" />
      <FlatList
        data={wishlistProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>💚</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No favorites yet</Text>
            <Text style={{ color: colors.textSecondary }}>Tap the heart on products you love</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { paddingHorizontal: 10, paddingBottom: 24 },
  gridItem: { width: "50%" },
  empty: { alignItems: "center", padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginTop: 12 }
});
