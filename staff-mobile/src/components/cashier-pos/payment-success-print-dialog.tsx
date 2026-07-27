import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { posColors, posRadius, posShadow, posSpacing, posType } from "./pos-theme";

type Props = {
  visible: boolean;
  orderNumber: string;
  onPrintNow: (dontAskAgain: boolean) => void;
  onLater: (dontAskAgain: boolean) => void;
};

/**
 * Shown after Confirm payment succeeds — chooses whether to open the existing print flow.
 */
export function PaymentSuccessPrintDialog({ visible, orderNumber, onPrintNow, onLater }: Props) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    if (visible) setDontAskAgain(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onLater(dontAskAgain)}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="summary">
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>✅</Text>
          </View>
          <Text style={styles.title}>Payment Successful</Text>
          <Text style={styles.subtitle}>
            Order #{orderNumber} has been completed successfully.{"\n"}Would you like to print the receipt now?
          </Text>

          <Pressable
            onPress={() => setDontAskAgain((v) => !v)}
            style={styles.checkRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dontAskAgain }}
          >
            <View style={[styles.checkbox, dontAskAgain && styles.checkboxOn]}>
              {dontAskAgain ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>Don't ask again</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => onPrintNow(dontAskAgain)}
            accessibilityRole="button"
            accessibilityLabel="Print Now"
          >
            <Text style={styles.primaryBtnText}>Print Now</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => onLater(dontAskAgain)}
            accessibilityRole="button"
            accessibilityLabel="Later"
          >
            <Text style={styles.secondaryBtnText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: posSpacing.lg
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: posColors.card,
    borderRadius: posRadius.lg,
    borderWidth: 1,
    borderColor: posColors.border,
    padding: posSpacing.xl,
    alignItems: "center",
    ...posShadow(true)
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: posColors.successMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: posSpacing.md
  },
  icon: { fontSize: 28 },
  title: {
    ...posType.h2,
    color: posColors.text,
    textAlign: "center",
    marginBottom: 8
  },
  subtitle: {
    ...posType.body,
    color: posColors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: posSpacing.lg
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 10,
    marginBottom: posSpacing.lg,
    paddingVertical: 4
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: posColors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: posColors.secondary
  },
  checkboxOn: {
    backgroundColor: posColors.success,
    borderColor: posColors.success
  },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  checkLabel: { ...posType.body, color: posColors.textSecondary, flex: 1 },
  primaryBtn: {
    alignSelf: "stretch",
    backgroundColor: posColors.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    alignSelf: "stretch",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: posColors.borderStrong,
    backgroundColor: posColors.secondary
  },
  secondaryBtnText: { color: posColors.text, fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.88 }
});
