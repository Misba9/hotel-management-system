import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ScreenHeader } from "@/src/components/layout/screen-header";

export default function HelpScreen() {
  const colors = useThemeColors();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Help & Support" />
      <View style={styles.body}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>How can we help?</Text>
        <Text style={[styles.p, { color: colors.textSecondary }]}>
          For order issues, delivery updates, or account help, reach our support team.
        </Text>

        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => Linking.openURL("mailto:support@nausheenfruits.com")}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>Email support</Text>
          <Text style={{ color: colors.primary, marginTop: 4 }}>support@nausheenfruits.com</Text>
        </Pressable>

        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => Linking.openURL("tel:+919876543210")}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>Call us</Text>
          <Text style={{ color: colors.primary, marginTop: 4 }}>+91 98765 43210</Text>
        </Pressable>

        <View style={[styles.faq, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.faqQ, { color: colors.textPrimary }]}>How do I track my order?</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
            Go to Orders tab and tap any order to see live status updates.
          </Text>
        </View>

        <View style={[styles.faq, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.faqQ, { color: colors.textPrimary }]}>Payment methods</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
            Cash on delivery is available in the app. Online payment is supported on the web store.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: 20 },
  heading: { fontSize: 20, fontWeight: "900", marginBottom: 8 },
  p: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  faq: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  faqQ: { fontWeight: "800", fontSize: 15 }
});
