import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { logReactError } from "../lib/error-logging";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Catches render/lifecycle errors in the subtree so the app shows a recovery UI instead of a blank screen.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logReactError(error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const detail = __DEV__ && this.state.error ? this.state.error.message : "";
      return (
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.box}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>
              {detail ? `${detail}\n\n` : ""}You can try again. If this keeps happening, restart the app.
            </Text>
            <Pressable onPress={this.handleRetry} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
              <Text style={styles.btnLabel}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  box: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: "800", color: "#f8fafc", marginBottom: 12 },
  body: { fontSize: 15, color: "#94a3b8", lineHeight: 22, marginBottom: 24 },
  btn: {
    alignSelf: "flex-start",
    backgroundColor: "#f97316",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12
  },
  btnPressed: { opacity: 0.9 },
  btnLabel: { color: "#fff", fontSize: 16, fontWeight: "800" }
});
