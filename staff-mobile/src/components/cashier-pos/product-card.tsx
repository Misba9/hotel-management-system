import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { staffColors } from "../../theme/staff-ui";
import type { MenuItemDoc } from "./pos-types";

type Props = {
  item: MenuItemDoc;
  qty: number;
  onAdd: () => void;
  onDec: () => void;
};

export function ProductCard({ item, qty, onAdd, onDec }: Props) {
  const imgUri = item.imageUrl ?? item.image;

  return (
    <View style={{ width: "50%", padding: 6 }}>
      <View
        style={{
          flex: 1,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: staffColors.border,
          backgroundColor: staffColors.surface,
          padding: 10,
          overflow: "hidden",
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.07,
          shadowRadius: 10,
          elevation: 3
        }}
      >
        {imgUri ? (
          <Image
            source={{ uri: imgUri }}
            style={{ width: "100%", height: 96, borderRadius: 12, backgroundColor: staffColors.border }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 96,
              borderRadius: 12,
              backgroundColor: "#f1f5f9",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: staffColors.muted, fontSize: 11 }}>No image</Text>
          </View>
        )}
        <Text numberOfLines={2} style={{ marginTop: 10, fontWeight: "800", fontSize: 13, color: staffColors.text, lineHeight: 18 }}>
          {item.name}
        </Text>
        {(item.category || item.categoryId) && (
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11, color: staffColors.muted }}>
            {item.category ?? item.categoryId}
          </Text>
        )}
        <Text style={{ marginTop: 8, fontWeight: "900", fontSize: 15, color: staffColors.accent }}>₹{item.price}</Text>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <TouchableOpacity
            onPress={onDec}
            disabled={qty <= 0}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              backgroundColor: qty <= 0 ? "#f1f5f9" : staffColors.border,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ fontWeight: "900", fontSize: 18, color: qty <= 0 ? "#cbd5e1" : staffColors.text }}>−</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: "900", fontSize: 15, color: staffColors.text, minWidth: 28, textAlign: "center" }}>{qty}</Text>
          <TouchableOpacity
            onPress={onAdd}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              backgroundColor: staffColors.info,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: staffColors.info,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 4,
              elevation: 3
            }}
          >
            <Text style={{ fontWeight: "900", color: "white", fontSize: 18 }}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={onAdd}
          activeOpacity={0.9}
          style={{
            marginTop: 10,
            borderRadius: 12,
            backgroundColor: `${staffColors.accent}14`,
            paddingVertical: 8,
            alignItems: "center",
            borderWidth: 1,
            borderColor: `${staffColors.accent}55`
          }}
        >
          <Text style={{ fontWeight: "800", fontSize: 13, color: staffColors.accent }}>Add to cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
