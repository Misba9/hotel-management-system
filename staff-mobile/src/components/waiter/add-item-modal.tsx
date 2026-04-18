import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { space, radius } from "../../theme/design-tokens";
import { staffColors } from "../../theme/staff-ui";

export type AddItemLine = {
  name: string;
  price: number;
  quantity: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Persist line to Firestore; total is recalculated server-side in the transaction. */
  onAdd: (line: AddItemLine) => Promise<void>;
  submitting?: boolean;
};

export function AddItemModal({ visible, onClose, onAdd, submitting = false }: Props) {
  const [name, setName] = useState("");
  const [priceText, setPriceText] = useState("");
  const [qtyText, setQtyText] = useState("1");

  useEffect(() => {
    if (visible) {
      setName("");
      setPriceText("");
      setQtyText("1");
    }
  }, [visible]);

  const handleAdd = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Item name", "Enter a name.");
      return;
    }
    const price = Number(String(priceText).replace(/,/g, "").trim());
    const qty = Math.floor(Number(String(qtyText).trim()));
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert("Price", "Enter a valid price (0 or more).");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      Alert.alert("Quantity", "Enter a whole number of at least 1.");
      return;
    }
    await onAdd({ name: trimmed, price, quantity: qty });
  }, [name, onAdd, priceText, qtyText]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={submitting ? undefined : onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={submitting ? undefined : onClose} accessibilityLabel="Dismiss" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboard}
        >
          <View style={styles.sheet}>
          <Text style={styles.title}>Add item</Text>
          <Text style={styles.label}>Item name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Fresh juice"
            placeholderTextColor={staffColors.muted}
            style={styles.input}
            editable={!submitting}
            autoCapitalize="sentences"
          />
          <Text style={styles.label}>Price (₹)</Text>
          <TextInput
            value={priceText}
            onChangeText={setPriceText}
            placeholder="0"
            placeholderTextColor={staffColors.muted}
            style={styles.input}
            editable={!submitting}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Quantity</Text>
          <TextInput
            value={qtyText}
            onChangeText={setQtyText}
            placeholder="1"
            placeholderTextColor={staffColors.muted}
            style={styles.input}
            editable={!submitting}
            keyboardType="number-pad"
          />
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={({ pressed }) => [styles.btnGhost, pressed && !submitting && styles.pressed]}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleAdd()}
              disabled={submitting}
              style={({ pressed }) => [styles.btnPrimary, submitting && styles.btnDisabled, pressed && !submitting && styles.pressed]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Add</Text>
              )}
            </Pressable>
          </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.45)" },
  keyboard: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: staffColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.lg,
    paddingBottom: space.section,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  title: { fontSize: 20, fontWeight: "800", color: staffColors.text, marginBottom: space.lg },
  label: { fontSize: 12, fontWeight: "700", color: staffColors.muted, marginBottom: space.xs, letterSpacing: 0.3 },
  input: {
    backgroundColor: staffColors.bg,
    borderWidth: 1,
    borderColor: staffColors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: 16,
    color: staffColors.text,
    marginBottom: space.md
  },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.md, justifyContent: "flex-end" },
  btnGhost: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md
  },
  btnGhostText: { fontWeight: "800", color: staffColors.muted },
  btnPrimary: {
    backgroundColor: staffColors.accent,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    minWidth: 120,
    alignItems: "center"
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.88 }
});
