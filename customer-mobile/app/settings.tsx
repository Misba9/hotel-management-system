import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MobileThemeSwitcher } from "@shared/theme/react-native/MobileThemeSwitcher";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";
import { getApiBaseUrl } from "@/src/lib/api";

export default function SettingsScreen() {
  const colors = useThemeColors();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Appearance</Text>
          <MobileThemeSwitcher />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>API endpoint</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>{getApiBaseUrl()}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>About</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
            Nausheen Fruits Customer App v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: 20 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  label: { fontWeight: "800", fontSize: 15 }
});
