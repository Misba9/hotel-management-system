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
};

export function ItemModificationsModal({
  visible,
  productName,
  initialModifications = [],
  initialNote = "",
  onClose,
  onSave
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Item modifications</Text>
          <Text style={styles.subtitle}>{productName}</Text>
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
          <TextInput
            value={draftNote}
            onChangeText={setDraftNote}
            placeholder="Other instructions (e.g. less sweet)"
            placeholderTextColor="#94a3b8"
            multiline
            style={styles.note}
          />
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onSave(draftMods, draftNote.trim())} style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    padding: 20
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155"
  },
  title: { fontSize: 18, fontWeight: "800", color: "#f8fafc" },
  subtitle: { marginTop: 4, marginBottom: 16, fontSize: 14, fontWeight: "600", color: "#94a3b8" },
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
    marginTop: 16,
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
  btnPrimaryText: { color: "#fff", fontWeight: "800" }
});

export function formatLineExtras(line: { modifications?: string[]; note?: string }): string | null {
  const parts = [...(line.modifications ?? [])];
  const note = line.note?.trim();
  if (note) parts.push(note);
  return parts.length > 0 ? parts.join(" · ") : null;
}
