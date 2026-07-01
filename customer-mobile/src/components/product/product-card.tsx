import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Product } from "@/src/lib/menu-data-types";
import { useCart } from "@/src/context/cart-context";
import { useFavorites } from "@/src/context/favorites-context";

type Props = {
  product: Product;
  onPress?: () => void;
};

export function ProductCard({ product, onPress }: Props) {
  const colors = useThemeColors();
  const { addItem, itemQty } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const qty = itemQty(product.id);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed
      ]}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.image }} style={styles.image} contentFit="cover" transition={200} />
        <Pressable style={styles.favBtn} onPress={() => toggleFavorite(product.id)} hitSlop={8}>
          <Ionicons
            name={isFavorite(product.id) ? "heart" : "heart-outline"}
            size={20}
            color={isFavorite(product.id) ? colors.danger : "#fff"}
          />
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={[styles.category, { color: colors.textSecondary }]}>{product.categoryName}</Text>
        <View style={styles.row}>
          <Text style={[styles.price, { color: colors.primary }]}>₹{product.price}</Text>
          {qty > 0 ? (
            <View style={[styles.qtyBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.qtyText}>{qty}</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => addItem(product)}
              hitSlop={8}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", flex: 1, margin: 6 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  imageWrap: { height: 120, position: "relative" },
  image: { width: "100%", height: "100%" },
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
    padding: 6
  },
  body: { padding: 12 },
  name: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  category: { fontSize: 11, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  price: { fontSize: 16, fontWeight: "800" },
  addBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  qtyBadge: { minWidth: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  qtyText: { color: "#fff", fontWeight: "800", fontSize: 14 }
});
