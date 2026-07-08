import React, { memo } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useResponsiveLayout } from "../../hooks/use-responsive-layout";
import type { MenuItemDoc } from "./pos-types";
import { PosIcon } from "./pos-icons";
import { PosHoverCard } from "./pos-ui";
import { posColors, posRadius, posSpacing, posTransition } from "./pos-theme";

type Props = {
  item: MenuItemDoc;
  qty: number;
  isFavorite: boolean;
  isBestSeller: boolean;
  onAdd: () => void;
  onDec: () => void;
  onToggleFavorite: () => void;
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

function stockLabel(item: MenuItemDoc) {
  if (item.available === false) return { text: "Out of Stock", emoji: "🔴", color: posColors.danger };
  const sq = item.stockQty;
  if (typeof sq === "number" && sq <= 0) return { text: "Out of Stock", emoji: "🔴", color: posColors.danger };
  if (typeof sq === "number" && sq < 5) return { text: `Low Stock (${sq})`, emoji: "🟡", color: posColors.warning };
  return { text: "Stock Available", emoji: "🟢", color: posColors.success };
}

export const ProductCard = memo(function ProductCard({
  item,
  qty,
  isFavorite,
  isBestSeller,
  onAdd,
  onDec,
  onToggleFavorite
}: Props) {
  const layout = useResponsiveLayout();
  const fonts = layout.productFonts;
  const img = item.imageUrl ?? item.image;
  const stock = stockLabel(item);
  const outOfStock = item.available === false || (typeof item.stockQty === "number" && item.stockQty <= 0);
  const btnSize = layout.scale(32);

  const tileStyle: ViewStyle = {
    ...styles.tile,
    borderRadius: layout.radius,
    padding: layout.padding * 0.75,
    flex: 1,
    ...(outOfStock ? styles.tileDisabled : null)
  };

  return (
    <PosHoverCard onPress={outOfStock ? undefined : onAdd} style={tileStyle}>
      <Pressable onPress={onToggleFavorite} style={styles.favBtn} hitSlop={8}>
        <PosIcon name="star" size={layout.moderateScale(14)} color={isFavorite ? posColors.warning : posColors.textDim} />
      </Pressable>

      {isBestSeller ? (
        <View style={styles.bestBadge}>
          <Text style={[styles.bestText, { fontSize: layout.moderateScale(8) }]}>⭐ Bestseller</Text>
        </View>
      ) : null}

      {img ? (
        <Image source={{ uri: img }} style={[styles.image, { borderRadius: layout.radius * 0.75 }]} resizeMode="cover" />
      ) : (
        <View style={[styles.imagePlaceholder, { borderRadius: layout.radius * 0.75 }]}>
          <PosIcon name="parcel" size={layout.iconSize} color={posColors.textDim} />
        </View>
      )}

      <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.name, { fontSize: fonts.title, lineHeight: fonts.title * 1.1 }]}>
        {item.name}
      </Text>
      <Text style={[styles.category, { fontSize: fonts.category }]} numberOfLines={1} ellipsizeMode="tail">
        {item.category ?? "Menu"}
      </Text>
      <Text style={[styles.price, { fontSize: fonts.price }]}>{formatMoney(item.price)}</Text>
      <View style={styles.stockRow}>
        <Text style={styles.stockEmoji}>{stock.emoji}</Text>
        <Text style={[styles.stockText, { fontSize: fonts.stock, color: stock.color }]} numberOfLines={1}>
          {stock.text}
        </Text>
      </View>

      <View style={styles.spacer} />

      <View style={styles.qtyRow}>
        <Pressable
          onPress={onDec}
          disabled={qty <= 0}
          style={[styles.qtyBtn, { width: btnSize, height: btnSize }, qty <= 0 && styles.qtyBtnOff]}
        >
          <PosIcon name="minus" size={layout.moderateScale(14)} color={qty <= 0 ? posColors.textDim : posColors.text} />
        </Pressable>
        <Text style={[styles.qty, { fontSize: fonts.qty }]}>{qty}</Text>
        <Pressable
          onPress={onAdd}
          disabled={outOfStock}
          style={[styles.qtyBtn, styles.qtyBtnAdd, { width: btnSize, height: btnSize }, outOfStock && styles.qtyBtnOff]}
        >
          <PosIcon name="plus" size={layout.moderateScale(14)} color="#fff" />
        </Pressable>
      </View>
    </PosHoverCard>
  );
});

const styles = StyleSheet.create({
  tile: {
    flexDirection: "column",
    overflow: "hidden",
    minHeight: 0,
    ...Platform.select({
      web: { ...posTransition, transition: "transform 180ms ease, box-shadow 180ms ease" } as ViewStyle,
      default: {}
    })
  },
  tileDisabled: { opacity: 0.55 },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    marginBottom: posSpacing.sm
  },
  imagePlaceholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: posSpacing.sm
  },
  name: {
    fontWeight: "800",
    color: posColors.text
  },
  category: {
    color: posColors.textDim,
    marginTop: 2,
    fontWeight: "600"
  },
  price: {
    fontWeight: "900",
    color: posColors.primary,
    marginTop: posSpacing.xs
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4
  },
  stockEmoji: { fontSize: 8 },
  stockText: { fontWeight: "700", flex: 1 },
  spacer: { flex: 1, minHeight: 4 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: posSpacing.sm
  },
  qtyBtn: {
    borderRadius: posRadius.pill,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: posColors.border
  },
  qtyBtnOff: { opacity: 0.4 },
  qtyBtnAdd: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  qty: { fontWeight: "900", color: posColors.text, minWidth: 28, textAlign: "center" },
  favBtn: { position: "absolute", top: 8, right: 8, zIndex: 2, padding: 4 },
  bestBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 2,
    backgroundColor: "rgba(245,158,11,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: posRadius.pill,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)"
  },
  bestText: { fontWeight: "800", color: posColors.warning }
});
