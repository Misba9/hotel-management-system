import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { useAuth } from "@/src/context/auth-context";
import { db } from "@/src/services/firebase";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read?: boolean;
};

export default function NotificationsScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            title: String(data.title ?? "Notification"),
            body: String(data.body ?? data.message ?? ""),
            createdAt: String(data.createdAt ?? ""),
            read: Boolean(data.read)
          };
        })
      );
    });
    return unsub;
  }, [user?.uid]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Notifications" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>🔔</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No notifications</Text>
            <Text style={{ color: colors.textSecondary }}>Updates about your orders will appear here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              {
                backgroundColor: item.read ? colors.surface : `${colors.primary}10`,
                borderColor: colors.border
              }
            ]}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 14 }}>{item.body}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { padding: 16 },
  empty: { alignItems: "center", padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginTop: 12 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 10 },
  title: { fontWeight: "800", fontSize: 15 }
});
