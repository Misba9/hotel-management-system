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
  const btnSize = layout.isTablet ? 44 : layout.scale(36);
  const cardPad = layout.isTablet ? 16 : layout.padding * 0.75;

  const tileStyle: ViewStyle = {
    ...styles.tile,
    borderRadius: layout.radius,
    padding: cardPad,
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
        {qty > 0 ? (
          <>
            <Pressable
              onPress={onDec}
              style={[styles.qtyBtn, { width: btnSize, height: btnSize }]}
            >
              <PosIcon name="minus" size={layout.moderateScale(14)} color={posColors.text} />
            </Pressable>
            <Text style={[styles.qty, { fontSize: fonts.qty }]}>{qty}</Text>
          </>
        ) : (
          <View style={styles.qtySpacer} />
        )}
        <Pressable
          onPress={onAdd}
          disabled={outOfStock}
          style={[
            styles.qtyBtn,
            styles.qtyBtnAdd,
            styles.qtyBtnAddLarge,
            { width: btnSize + 4, height: btnSize + 4 },
            outOfStock && styles.qtyBtnOff
          ]}
          accessibilityLabel={`Add ${item.name}`}
        >
          <PosIcon name="plus" size={layout.moderateScale(16)} color="#fff" />
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
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.borderStrong,
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
    marginBottom: posSpacing.sm,
    borderWidth: 1,
    borderColor: posColors.border
  },
  name: {
    fontWeight: "800",
    color: posColors.text
  },
  category: {
    color: posColors.textDim,
    marginTop: 4,
    fontWeight: "600"
  },
  price: {
    fontWeight: "900",
    color: posColors.primary,
    marginTop: posSpacing.sm
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6
  },
  stockEmoji: { fontSize: 10 },
  stockText: { fontWeight: "700", flex: 1 },
  spacer: { flex: 1, minHeight: 8 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: posSpacing.sm,
    marginTop: posSpacing.md
  },
  qtySpacer: { flex: 1 },
  qtyBtn: {
    borderRadius: posRadius.pill,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: posColors.borderStrong
  },
  qtyBtnOff: { opacity: 0.4 },
  qtyBtnAdd: { backgroundColor: posColors.success, borderColor: posColors.success },
  qtyBtnAddLarge: {
    ...Platform.select({
      ios: {
        shadowColor: "#22C55E",
        shadowOpacity: 0.35,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }
      },
      android: { elevation: 3 },
      default: {}
    })
  },
  qty: { fontWeight: "900", color: posColors.text, minWidth: 32, textAlign: "center" },
  favBtn: { position: "absolute", top: 10, right: 10, zIndex: 2, padding: 6 },
  bestBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 2,
    backgroundColor: "rgba(245,158,11,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: posRadius.pill,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.45)"
  },
  bestText: { fontWeight: "800", color: posColors.warning }
});
