import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback message={this.state.message} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Something went wrong</Text>
      {message ? <Text style={[styles.msg, { color: colors.textSecondary }]}>{message}</Text> : null}
      <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={onRetry}>
        <Text style={styles.btnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  msg: { fontSize: 14, textAlign: "center", marginBottom: 20 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: "#fff", fontWeight: "700" }
});
