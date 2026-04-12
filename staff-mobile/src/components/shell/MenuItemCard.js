import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { shell, shellShadow } from "../../theme/shell-theme";
import { Button } from "./Button";

/**
 * @param {{
 *   id: string,
 *   name: string,
 *   price: number,
 *   imageUrl?: string | null,
 *   selected?: boolean,
 *   onAdd: () => void,
 *   currency?: string
 * }}
 */
export function MenuItemCard({ name, price, imageUrl, selected = false, onAdd, currency = "₹" }) {
  return (
    <View style={[styles.wrap, selected && styles.wrapSelected, shellShadow(2)]}>
      <View style={styles.imageBox}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>🍽</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.price}>
        {currency}
        {price.toFixed(0)}
      </Text>
      <Button title="Add" onPress={onAdd} variant="primary" style={styles.btn} />
    </View>
  );
}

/** Compact row variant for horizontal lists */
export function MenuItemRow({ name, price, onAdd, currency = "₹" }) {
  return (
    <View style={[styles.row, shellShadow(1)]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowPrice}>
          {currency}
          {price.toFixed(0)}
        </Text>
      </View>
      <Pressable onPress={onAdd} style={styles.rowAdd}>
        <Text style={styles.rowAddText}>+ Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "47%",
    maxWidth: 200,
    borderRadius: 16,
    padding: 12,
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.border,
    marginBottom: 12
  },
  wrapSelected: {
    borderColor: shell.primary,
    backgroundColor: shell.chipBg
  },
  imageBox: { borderRadius: 12, overflow: "hidden", marginBottom: 8 },
  image: { width: "100%", aspectRatio: 1, backgroundColor: shell.bg },
  placeholder: {
    aspectRatio: 1,
    backgroundColor: shell.bg,
    alignItems: "center",
    justifyContent: "center"
  },
  placeholderEmoji: { fontSize: 36 },
  name: { fontSize: 14, fontWeight: "700", color: shell.text, minHeight: 40 },
  price: { fontSize: 15, fontWeight: "800", color: shell.primary, marginBottom: 10 },
  btn: { paddingVertical: 10, minHeight: 42 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.border,
    marginBottom: 10
  },
  rowName: { fontSize: 15, fontWeight: "700", color: shell.text },
  rowPrice: { fontSize: 14, fontWeight: "800", color: shell.primary, marginTop: 4 },
  rowAdd: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: shell.chipBg
  },
  rowAddText: { fontSize: 14, fontWeight: "800", color: shell.primary }
});
