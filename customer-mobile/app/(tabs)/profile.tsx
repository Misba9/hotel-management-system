import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MobileThemeSwitcher } from "@shared/theme/react-native/MobileThemeSwitcher";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Button } from "@/src/components/ui/button";
import { useAuth } from "@/src/context/auth-context";
import { useUserProfile } from "@/src/hooks/use-user-profile";

type MenuItem = { icon: keyof typeof Ionicons.glyphMap; label: string; href: string };

const MENU: MenuItem[] = [
  { icon: "location-outline", label: "Addresses", href: "/addresses" },
  { icon: "heart-outline", label: "Wishlist", href: "/wishlist" },
  { icon: "pricetag-outline", label: "Coupons", href: "/coupons" },
  { icon: "notifications-outline", label: "Notifications", href: "/notifications" },
  { icon: "settings-outline", label: "Settings", href: "/settings" },
  { icon: "help-circle-outline", label: "Help & Support", href: "/help" }
];

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const displayName = profile?.name || user?.displayName || "Customer";
  const email = profile?.email || user?.email || "";
  const phone = profile?.phone || user?.phoneNumber || "";

  return (
    <ScrollView style={[styles.wrap, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{displayName}</Text>
        {email ? <Text style={{ color: colors.textSecondary }}>{email}</Text> : null}
        {phone ? <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{phone}</Text> : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {MENU.map((item, i) => (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as never)}
            style={[
              styles.menuRow,
              i < MENU.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
            ]}
          >
            <Ionicons name={item.icon} size={22} color={colors.textPrimary} />
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.themeLabel, { color: colors.textPrimary }]}>Appearance</Text>
        <MobileThemeSwitcher />
      </View>

      <Button title="Sign out" variant="secondary" onPress={() => logout()} style={{ marginHorizontal: 20, marginTop: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { alignItems: "center", paddingBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "900" },
  name: { fontSize: 22, fontWeight: "900", marginTop: 12 },
  card: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: "600" },
  themeCard: { marginHorizontal: 20, marginTop: 16, borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  themeLabel: { fontSize: 16, fontWeight: "600" }
});
