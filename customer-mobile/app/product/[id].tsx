import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { Button } from "@/src/components/ui/button";
import { LoadingView } from "@/src/components/ui/loading-view";
import { useCart } from "@/src/context/cart-context";
import { useFavorites } from "@/src/context/favorites-context";
import { useMenu } from "@/src/hooks/use-menu";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const router = useRouter();
  const { products, loading } = useMenu();
  const { addItem, itemQty } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const product = products.find((p) => p.id === id);
  const qty = product ? itemQty(product.id) : 0;

  if (loading && !product) return <LoadingView />;
  if (!product) {
    return (
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Product" />
        <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 40 }}>Product not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title=""
        right={
          <Pressable onPress={() => toggleFavorite(product.id)} hitSlop={12}>
            <Ionicons
              name={isFavorite(product.id) ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite(product.id) ? colors.danger : colors.textPrimary}
            />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={{ uri: product.image }} style={styles.hero} contentFit="cover" transition={300} />
        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{product.name}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{product.categoryName}</Text>
          <Text style={[styles.price, { color: colors.primary }]}>₹{product.price}</Text>
          {product.description ? (
            <Text style={[styles.desc, { color: colors.textSecondary }]}>{product.description}</Text>
          ) : (
            <Text style={[styles.desc, { color: colors.textSecondary }]}>
              Fresh, hand-picked quality from Nausheen Fruits.
            </Text>
          )}
        </View>
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {qty > 0 ? (
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{qty} in cart</Text>
        ) : null}
        <Button
          title={qty > 0 ? "Add more" : "Add to cart"}
          onPress={() => {
            addItem(product);
            router.push("/(tabs)/cart");
          }}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { paddingBottom: 100 },
  hero: { width: "100%", height: 280 },
  body: { padding: 20 },
  name: { fontSize: 24, fontWeight: "900" },
  price: { fontSize: 28, fontWeight: "900", marginTop: 12 },
  desc: { fontSize: 15, lineHeight: 22, marginTop: 16 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderTopWidth: 1
  }
});
