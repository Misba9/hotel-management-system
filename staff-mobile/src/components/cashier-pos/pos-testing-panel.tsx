import React from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useCashierPosStore } from "../../lib/pos/cashier-pos-store";
import { PosButton } from "./pos-ui";
import { posCard, posColors, posGlass, posRadius, posShadow, posSpacing, posType } from "./pos-theme";

export function PosTestingFab() {
  const setShowTestPanel = useCashierPosStore((s) => s.setShowTestPanel);
  return (
    <Pressable style={styles.fab} onPress={() => setShowTestPanel(true)}>
      <Text style={styles.fabEmoji}>🧪</Text>
      <Text style={styles.fabLabel}>Test Orders</Text>
    </Pressable>
  );
}

export function PosTestingPanelModal() {
  const show = useCashierPosStore((s) => s.showTestPanel);
  const setShow = useCashierPosStore((s) => s.setShowTestPanel);
  const generateTest = useCashierPosStore((s) => s.generateTest);
  const clearTestOrders = useCashierPosStore((s) => s.clearTestOrders);
  const randomStatus = useCashierPosStore((s) => s.randomStatus);
  const randomPayment = useCashierPosStore((s) => s.randomPayment);
  const randomTime = useCashierPosStore((s) => s.randomTime);
  const setRandomStatus = useCashierPosStore((s) => s.setRandomStatus);
  const setRandomPayment = useCashierPosStore((s) => s.setRandomPayment);
  const setRandomTime = useCashierPosStore((s) => s.setRandomTime);
  const testCount = useCashierPosStore((s) => s.testOrders.length);

  return (
    <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, posGlass(), posShadow(true)]}>
          <View style={styles.header}>
            <Text style={posType.h2}>🧪 Developer Testing Panel</Text>
            <Pressable onPress={() => setShow(false)}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle}>Generate Dummy Orders · {testCount} test orders active</Text>

          <View style={styles.toggles}>
            <ToggleRow label="Random Status" value={randomStatus} onChange={setRandomStatus} />
            <ToggleRow label="Random Payment" value={randomPayment} onChange={setRandomPayment} />
            <ToggleRow label="Random Time" value={randomTime} onChange={setRandomTime} />
          </View>

          <Text style={posType.label}>Generate</Text>
          <View style={styles.grid}>
            <GenBtn label="Parcel" emoji="🛍" onPress={() => generateTest("parcel")} />
            <GenBtn label="Swiggy" emoji="🛵" onPress={() => generateTest("swiggy")} />
            <GenBtn label="Zomato" emoji="🍔" onPress={() => generateTest("zomato")} />
            <GenBtn label="Online" emoji="🌐" onPress={() => generateTest("online")} />
            <GenBtn label="Waiter" emoji="👨" onPress={() => generateTest("waiter")} />
            <GenBtn label="Mixed" emoji="🔀" onPress={() => generateTest("mixed", 5)} wide />
            <GenBtn label="50 Orders" emoji="📦" onPress={() => generateTest("mixed", 50)} wide />
          </View>

          <PosButton
            label="Clear All Test Orders"
            variant="danger"
            onPress={clearTestOrders}
            fullWidth
            style={styles.clearBtn}
          />
        </View>
      </View>
    </Modal>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: posColors.card, true: posColors.primaryMuted }}
        thumbColor={value ? posColors.primary : posColors.textDim}
      />
    </View>
  );
}

function GenBtn({ label, emoji, onPress, wide }: { label: string; emoji: string; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[posCard(), styles.genBtn, wide && styles.genBtnWide]}>
      <Text style={styles.genEmoji}>{emoji}</Text>
      <Text style={styles.genLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 24,
    left: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: posRadius.pill,
    backgroundColor: posColors.purple,
    zIndex: 100,
    ...posShadow(true)
  },
  fabEmoji: { fontSize: 18 },
  fabLabel: { fontSize: 13, fontWeight: "800", color: "#fff" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: posSpacing.lg
  },
  panel: {
    width: "100%",
    maxWidth: 480,
    borderRadius: posRadius.xl,
    padding: posSpacing.xl
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  close: { fontSize: 20, color: posColors.textDim, padding: 8 },
  subtitle: { ...posType.small, marginTop: posSpacing.sm, marginBottom: posSpacing.lg },
  toggles: { gap: 8, marginBottom: posSpacing.lg },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: posColors.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: posSpacing.sm, marginBottom: posSpacing.lg },
  genBtn: {
    width: "30%",
    minWidth: 120,
    padding: posSpacing.md,
    alignItems: "center",
    gap: 4
  },
  genBtnWide: { width: "47%" },
  genEmoji: { fontSize: 24 },
  genLabel: { fontSize: 12, fontWeight: "800", color: posColors.text },
  clearBtn: { marginTop: posSpacing.sm }
});
