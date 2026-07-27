import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { POS_ITEM_MODIFICATIONS } from "../src/components/cashier-pos/pos-types";

type ItemModificationsModalProps = {
  visible: boolean;
  productName: string;
  initialModifications?: string[];
  initialNote?: string;
  onClose: () => void;
  onSave: (mods: string[], note: string) => void;
  /** Optional qty controls (Cashier / Waiter cart edit). */
  quantity?: number;
  onQuantityChange?: (qty: number) => void;
  onRemove?: () => void;
  unitPrice?: number;
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

/**
 * Shared item customization sheet used by Waiter POS and Cashier Current Bill.
 */
export function ItemModificationsModal({
  visible,
  productName,
  initialModifications = [],
  initialNote = "",
  onClose,
  onSave,
  quantity,
  onQuantityChange,
  onRemove,
  unitPrice
}: ItemModificationsModalProps) {
  const [draftMods, setDraftMods] = useState<string[]>(initialModifications);
  const [draftNote, setDraftNote] = useState(initialNote);

  useEffect(() => {
    if (!visible) return;
    setDraftMods(initialModifications);
    setDraftNote(initialNote);
  }, [visible, initialModifications, initialNote]);

  const toggleMod = (mod: string) => {
    setDraftMods((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  };

  const showQty = typeof quantity === "number" && typeof onQuantityChange === "function";
  const lineTotal =
    showQty && typeof unitPrice === "number" ? formatMoney(unitPrice * Math.max(1, quantity)) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Item modifications</Text>
          <Text style={styles.subtitle}>{productName}</Text>

          {showQty ? (
            <View style={styles.qtyBlock}>
              <Text style={styles.sectionLabel}>Quantity</Text>
              <View style={styles.qtyRow}>
                <Pressable
                  onPress={() => onQuantityChange(Math.max(1, quantity - 1))}
                  style={styles.qtyBtn}
                  accessibilityLabel="Decrease quantity"
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{quantity}</Text>
                <Pressable
                  onPress={() => onQuantityChange(quantity + 1)}
                  style={[styles.qtyBtn, styles.qtyBtnAdd]}
                  accessibilityLabel="Increase quantity"
                >
                  <Text style={styles.qtyBtnTextAdd}>+</Text>
                </Pressable>
                {lineTotal ? <Text style={styles.lineTotal}>{lineTotal}</Text> : null}
              </View>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Customizations</Text>
          <View style={styles.modGrid}>
            {POS_ITEM_MODIFICATIONS.map((mod) => {
              const on = draftMods.includes(mod);
              return (
                <Pressable
                  key={mod}
                  onPress={() => toggleMod(mod)}
                  style={[styles.modChip, on && styles.modChipOn]}
                >
                  <Text style={[styles.modChipText, on && styles.modChipTextOn]}>{mod}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Kitchen note</Text>
          <TextInput
            value={draftNote}
            onChangeText={setDraftNote}
            placeholder="Other instructions (e.g. less sweet)"
            placeholderTextColor="#94a3b8"
            multiline
            style={styles.note}
          />

          <View style={styles.actions}>
            {onRemove ? (
              <Pressable
                onPress={() => {
                  onRemove();
                  onClose();
                }}
                style={[styles.btn, styles.btnDanger]}
              >
                <Text style={styles.btnDangerText}>Remove</Text>
              </Pressable>
            ) : (
              <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => onSave(draftMods, draftNote.trim())}
              style={[styles.btn, styles.btnPrimary]}
            >
              <Text style={styles.btnPrimaryText}>Save</Text>
            </Pressable>
          </View>
          {onRemove ? (
            <Pressable onPress={onClose} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end"
  },
  card: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: "#334155",
    maxHeight: "88%"
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#475569",
    marginBottom: 12
  },
  title: { fontSize: 18, fontWeight: "800", color: "#f8fafc" },
  subtitle: { marginTop: 4, marginBottom: 12, fontSize: 14, fontWeight: "600", color: "#94a3b8" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8
  },
  qtyBlock: { marginBottom: 14 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center"
  },
  qtyBtnAdd: { backgroundColor: "#0d9488", borderColor: "#0d9488" },
  qtyBtnText: { fontSize: 22, fontWeight: "800", color: "#e2e8f0" },
  qtyBtnTextAdd: { fontSize: 22, fontWeight: "800", color: "#fff" },
  qtyValue: {
    minWidth: 36,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "900",
    color: "#f8fafc"
  },
  lineTotal: { marginLeft: "auto", fontSize: 16, fontWeight: "800", color: "#22c55e" },
  modGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e293b"
  },
  modChipOn: { backgroundColor: "#0d9488" },
  modChipText: { fontSize: 12, fontWeight: "700", color: "#e2e8f0" },
  modChipTextOn: { color: "#fff" },
  note: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top"
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnGhost: { borderWidth: 1, borderColor: "#475569" },
  btnGhostText: { color: "#e2e8f0", fontWeight: "800" },
  btnPrimary: { backgroundColor: "#f97316" },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  btnDanger: { borderWidth: 1, borderColor: "rgba(239,68,68,0.5)", backgroundColor: "rgba(239,68,68,0.12)" },
  btnDangerText: { color: "#f87171", fontWeight: "800" },
  cancelLink: { alignItems: "center", marginTop: 10, paddingVertical: 6 },
  cancelLinkText: { color: "#94a3b8", fontWeight: "700", fontSize: 13 }
});

export function formatLineExtras(line: { modifications?: string[]; note?: string }): string | null {
  const parts = [...(line.modifications ?? [])];
  const note = line.note?.trim();
  if (note) parts.push(note);
  return parts.length > 0 ? parts.join(" · ") : null;
}
