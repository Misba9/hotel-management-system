import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { PhoneLoginForm } from "@/src/components/auth/phone-login-form";
import { EmailLoginForm } from "@/src/components/auth/email-login-form";
import { GoogleSignInPanel } from "@/src/components/auth/google-sign-in-panel";
import { AppleSignInPanel } from "@/src/components/auth/apple-sign-in-panel";

export type AuthTab = "phone" | "email" | "google" | "apple";

type Props = {
  onSuccess: () => void;
  defaultTab?: AuthTab;
  emailMode?: "signin" | "signup";
  initialPhone?: string;
  autoSendPhone?: boolean;
};

const TABS: { id: AuthTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "phone", label: "Phone", icon: "phone-portrait-outline" },
  { id: "email", label: "Email", icon: "mail-outline" },
  { id: "google", label: "Google", icon: "logo-google" },
  { id: "apple", label: "Apple", icon: "logo-apple" }
];

export function AuthMethodTabs({
  onSuccess,
  defaultTab = "phone",
  emailMode = "signin",
  initialPhone,
  autoSendPhone
}: Props) {
  const colors = useThemeColors();
  const [tab, setTab] = useState<AuthTab>(defaultTab);
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.tabList,
          { backgroundColor: colors.hover, opacity: busy ? 0.5 : 1 }
        ]}
        pointerEvents={busy ? "none" : "auto"}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              disabled={busy}
              onPress={() => setTab(t.id)}
              style={[
                styles.tab,
                active
                  ? {
                      backgroundColor: colors.surface,
                      borderColor: colors.primary,
                      borderWidth: 1
                    }
                  : { borderColor: "transparent", borderWidth: 1 }
              ]}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? colors.primary : colors.textSecondary }
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {tab === "phone" ? (
          <PhoneLoginForm
            onSuccess={onSuccess}
            onAuthBusyChange={setBusy}
            initialPhone={initialPhone}
            autoSend={autoSendPhone}
          />
        ) : null}
        {tab === "email" ? (
          <EmailLoginForm
            onSuccess={onSuccess}
            onAuthBusyChange={setBusy}
            initialMode={emailMode}
          />
        ) : null}
        {tab === "google" ? (
          <GoogleSignInPanel onSuccess={onSuccess} onAuthBusyChange={setBusy} />
        ) : null}
        {tab === "apple" ? (
          <AppleSignInPanel onSuccess={onSuccess} onAuthBusyChange={setBusy} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  tabList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderRadius: 14,
    padding: 8,
    marginBottom: 20
  },
  tab: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12
  },
  tabLabel: { fontSize: 12, fontWeight: "700" },
  content: { width: "100%" }
});
