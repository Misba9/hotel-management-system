import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PosNotification } from "./pos-types";
import { PosIcon } from "./pos-icons";
import { posCard, posColors, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  visible: boolean;
  notifications: PosNotification[];
  unreadCount: number;
  onClose: () => void;
  onMarkRead: () => void;
};

const kindColor: Record<PosNotification["kind"], string> = {
  kitchen: posColors.primary,
  payment: posColors.success,
  table: "#8B5CF6",
  stock: posColors.warning,
  swiggy: "#F97316",
  zomato: "#E23744",
  refund: posColors.danger,
  manager: posColors.primary
};

export function PosNotificationsBell({ unreadCount, onPress }: { unreadCount: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.bell} accessibilityLabel="Notifications">
      <PosIcon name="bell" size={18} color={posColors.textSecondary} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function PosNotificationsPanel({ visible, notifications, onClose, onMarkRead }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[posCard(true), styles.panel]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={posType.h3}>Notifications</Text>
            <Pressable onPress={onMarkRead}>
              <Text style={styles.markRead}>Mark read</Text>
            </Pressable>
          </View>
          <ScrollView>
            {notifications.length === 0 ? (
              <Text style={[posType.small, styles.empty]}>All caught up</Text>
            ) : (
              notifications.map((n) => (
                <View key={n.id} style={[styles.item, { borderLeftColor: kindColor[n.kind] }]}>
                  <Text style={styles.itemTitle}>{n.title}</Text>
                  <Text style={posType.small}>{n.body}</Text>
                  <Text style={styles.itemTime}>{n.time.toLocaleTimeString()}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, alignItems: "center", justifyContent: "center", position: "relative" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: posColors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  panel: {
    position: "absolute",
    top: 56,
    right: 16,
    width: 340,
    maxHeight: 420,
    overflow: "hidden"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: posSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border
  },
  markRead: { fontSize: 12, fontWeight: "700", color: posColors.primary },
  empty: { padding: posSpacing.xxl, textAlign: "center" },
  item: {
    padding: posSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    borderLeftWidth: 3
  },
  itemTitle: { fontSize: 13, fontWeight: "800", color: posColors.text },
  itemTime: { fontSize: 10, color: posColors.textDim, marginTop: 4 }
});
