import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { useAuth } from "@/src/context/auth-context";
import { useUserProfile } from "@/src/hooks/use-user-profile";
import { db } from "@/src/services/firebase";

type AddressRow = {
  id: string;
  label: string;
  addressLine: string;
  city: string;
  pincode?: string;
};

export default function AddressesScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    const fromProfile = profile?.addresses?.map((a) => ({
      id: a.id,
      label: a.label,
      addressLine: a.addressLine,
      city: a.city,
      pincode: a.pincode
    }));
    if (fromProfile?.length) {
      setAddresses(fromProfile);
      return;
    }

    const unsub = onSnapshot(collection(db, "users", user.uid, "addresses"), (snap) => {
      setAddresses(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            label: String(data.label ?? "Home"),
            addressLine: String(data.addressLine ?? data.street ?? data.address ?? ""),
            city: String(data.city ?? ""),
            pincode: typeof data.pincode === "string" ? data.pincode : undefined
          };
        })
      );
    });
    return unsub;
  }, [user?.uid, profile?.addresses]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Addresses" />
      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>📍</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No saved addresses</Text>
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              Add delivery addresses from the web app or during checkout
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.primary }]}>{item.label}</Text>
            <Text style={{ color: colors.textPrimary, marginTop: 4 }}>{item.addressLine}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
              {[item.city, item.pincode].filter(Boolean).join(", ")}
            </Text>
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
  label: { fontWeight: "800", fontSize: 13, textTransform: "uppercase" }
});
