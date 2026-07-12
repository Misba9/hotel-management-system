import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MenuItemDoc } from "./pos-types";
import { comboToCartLines, resolveCombosFromMenu, type ComboDeal } from "../../lib/pos/combo-catalog";
import { posCard, posColors, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  products: MenuItemDoc[];
  onAddCombo: (lines: ReturnType<typeof comboToCartLines>) => void;
};

export function PosComboSection({ products, onAddCombo }: Props) {
  const combos = useMemo(() => resolveCombosFromMenu(products), [products]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {combos.map((combo) => (
        <ComboCard key={combo.id} combo={combo} products={products} onAdd={() => onAddCombo(comboToCartLines(combo, products))} />
      ))}
    </ScrollView>
  );
}

function ComboCard({ combo, products, onAdd }: { combo: ComboDeal; products: MenuItemDoc[]; onAdd: () => void }) {
  const parts = combo.items
    .map((n) => products.find((p) => p.name.toLowerCase().includes(n))?.name ?? n)
    .join(" + ");

  return (
    <Pressable onPress={onAdd} style={[posCard(), styles.card]}>
      {combo.badge ? <Text style={styles.badge}>{combo.badge}</Text> : null}
      <Text style={posType.h3}>{combo.name}</Text>
      <Text style={posType.small} numberOfLines={2}>
        {parts}
      </Text>
      <Text style={styles.price}>₹{combo.price}</Text>
      <Text style={styles.add}>One-click add</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: posSpacing.lg, paddingVertical: posSpacing.sm, gap: posSpacing.md },
  card: { flexGrow: 1, minWidth: 160, padding: posSpacing.md },
  badge: { fontSize: 9, fontWeight: "800", color: posColors.warning, marginBottom: 4 },
  price: { fontSize: 20, fontWeight: "900", color: posColors.primary, marginTop: posSpacing.sm },
  add: { fontSize: 11, fontWeight: "800", color: posColors.success, marginTop: 6 }
});
