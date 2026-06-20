import React, { memo } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { MenuItemDoc } from "./pos-types";
import { PosIcon } from "./pos-icons";
import { PosHoverCard } from "./pos-ui";
import { posColors, posRadius, posSpacing, posTransition } from "./pos-theme";

export const PRODUCT_CARD_IMAGE_HEIGHT = 100;

type Props = {
  item: MenuItemDoc;
  qty: number;
  isFavorite: boolean;
  isBestSeller: boolean;
  width: number;
  height: number;
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
  width,
  height,
  onAdd,
  onDec,
  onToggleFavorite
}: Props) {
  const img = item.imageUrl ?? item.image;
  const stock = stockLabel(item);
  const outOfStock = item.available === false || (typeof item.stockQty === "number" && item.stockQty <= 0);

  const tileStyle: ViewStyle = {
    ...styles.tile,
    width,
    height,
    ...(outOfStock ? styles.tileDisabled : null)
  };

  return (
    <PosHoverCard onPress={outOfStock ? undefined : onAdd} style={tileStyle}>
      <Pressable onPress={onToggleFavorite} style={styles.favBtn} hitSlop={8}>
        <PosIcon name="star" size={14} color={isFavorite ? posColors.warning : posColors.textDim} />
      </Pressable>

      {isBestSeller ? (
        <View style={styles.bestBadge}>
          <Text style={styles.bestText}>⭐ Bestseller</Text>
        </View>
      ) : null}

      {img ? (
        <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <PosIcon name="parcel" size={28} color={posColors.textDim} />
        </View>
      )}

      <Text numberOfLines={2} ellipsizeMode="tail" style={styles.name}>
        {item.name}
      </Text>
      <Text style={styles.category} numberOfLines={1} ellipsizeMode="tail">
        {item.category ?? "Menu"}
      </Text>
      <Text style={styles.price}>{formatMoney(item.price)}</Text>
      <View style={styles.stockRow}>
        <Text style={styles.stockEmoji}>{stock.emoji}</Text>
        <Text style={[styles.stockText, { color: stock.color }]} numberOfLines={1}>
          {stock.text}
        </Text>
      </View>

      <View style={styles.spacer} />

      <View style={styles.qtyRow}>
        <Pressable onPress={onDec} disabled={qty <= 0} style={[styles.qtyBtn, qty <= 0 && styles.qtyBtnOff]}>
          <PosIcon name="minus" size={14} color={qty <= 0 ? posColors.textDim : posColors.text} />
        </Pressable>
        <Text style={styles.qty}>{qty}</Text>
        <Pressable
          onPress={onAdd}
          disabled={outOfStock}
          style={[styles.qtyBtn, styles.qtyBtnAdd, outOfStock && styles.qtyBtnOff]}
        >
          <PosIcon name="plus" size={14} color="#fff" />
        </Pressable>
      </View>
    </PosHoverCard>
  );
});

const styles = StyleSheet.create({
  tile: {
    flexDirection: "column",
    padding: posSpacing.md,
    overflow: "hidden",
    ...Platform.select({
      web: { ...posTransition, transition: "transform 180ms ease, box-shadow 180ms ease" } as ViewStyle,
      default: {}
    })
  },
  tileDisabled: { opacity: 0.55 },
  image: {
    width: "100%",
    height: PRODUCT_CARD_IMAGE_HEIGHT,
    borderRadius: 12,
    marginBottom: posSpacing.sm
  },
  imagePlaceholder: {
    width: "100%",
    height: PRODUCT_CARD_IMAGE_HEIGHT,
    borderRadius: 12,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: posSpacing.sm
  },
  name: {
    fontSize: 13,
    fontWeight: "800",
    color: posColors.text,
    height: 34,
    lineHeight: 17
  },
  category: {
    fontSize: 10,
    color: posColors.textDim,
    marginTop: 2,
    fontWeight: "600",
    height: 14
  },
  price: {
    fontSize: 16,
    fontWeight: "900",
    color: posColors.primary,
    marginTop: posSpacing.xs,
    height: 20
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    height: 14
  },
  stockEmoji: { fontSize: 8 },
  stockText: { fontSize: 9, fontWeight: "700", flex: 1 },
  spacer: { flex: 1, minHeight: 4 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: posSpacing.sm,
    height: 32
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: posRadius.pill,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: posColors.border
  },
  qtyBtnOff: { opacity: 0.4 },
  qtyBtnAdd: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  qty: { fontSize: 15, fontWeight: "900", color: posColors.text, minWidth: 28, textAlign: "center" },
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
  bestText: { fontSize: 8, fontWeight: "800", color: posColors.warning }
});
