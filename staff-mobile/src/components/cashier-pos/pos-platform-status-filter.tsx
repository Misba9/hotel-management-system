import React, { memo, useCallback, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle
} from "react-native";
import type { PlatformTab } from "../../lib/pos/cashier-pos-store";
import type { OrderStatusFilter } from "../../lib/pos/order-source";
import { PLATFORM_STATUS_OPTIONS } from "../../lib/pos/platform-status-filters";
import { posCard, posColors, posGlass, posRadius, posShadow, posSpacing, posType } from "./pos-theme";

type AnchorRect = { x: number; y: number; width: number; height: number };

type Props = {
  platform: PlatformTab;
  activeStatus: OrderStatusFilter;
  statusCounts: Record<OrderStatusFilter, number>;
  onStatusChange: (status: OrderStatusFilter) => void;
  /** Full width when stacked below search on mobile. */
  fullWidth?: boolean;
  style?: ViewStyle;
};

const MENU_GAP = 6;
const MENU_MIN_WIDTH = 200;
const MENU_MAX_WIDTH = 280;

/** Compact status dropdown — opens directly below the trigger button. */
export const PosPlatformStatusFilter = memo(function PosPlatformStatusFilter({
  platform,
  activeStatus,
  statusCounts,
  onStatusChange,
  fullWidth,
  style
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const options = PLATFORM_STATUS_OPTIONS[platform];
  const activeLabel = options.find((o) => o.id === activeStatus)?.label ?? "All";

  const close = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  const openMenu = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  const menuWidth = anchor
    ? Math.min(MENU_MAX_WIDTH, Math.max(MENU_MIN_WIDTH, anchor.width))
    : MENU_MIN_WIDTH;

  const menuLeft = anchor
    ? Math.max(posSpacing.sm, Math.min(anchor.x, windowWidth - menuWidth - posSpacing.sm))
    : 0;

  const menuTop = anchor ? anchor.y + anchor.height + MENU_GAP : 0;

  return (
    <View ref={anchorRef} style={[styles.anchor, fullWidth && styles.anchorFull, style]} collapsable={false}>
      <Pressable
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={`Status filter: ${activeLabel}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.trigger,
          posCard(),
          fullWidth && styles.triggerFull,
          pressed && styles.triggerPressed
        ]}
      >
        <Text style={styles.triggerPrefix}>Status:</Text>
        <Text style={styles.triggerValue} numberOfLines={1}>
          {activeLabel}
        </Text>
        <Text style={styles.chevron}>▼</Text>
      </Pressable>

      <Modal visible={open && anchor != null} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View
            style={[
              styles.menu,
              posGlass(),
              posShadow(true),
              {
                top: menuTop,
                left: menuLeft,
                width: menuWidth
              }
            ]}
          >
            <Text style={styles.menuTitle}>Status</Text>
            <ScrollView style={styles.menuScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {options.map((opt) => {
                const selected = activeStatus === opt.id;
                const cnt = statusCounts[opt.id] ?? 0;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      onStatusChange(opt.id);
                      close();
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    style={[styles.menuItem, selected && styles.menuItemOn]}
                  >
                    <Text style={[styles.menuItemText, selected && styles.menuItemTextOn]}>
                      {selected ? "✓ " : "  "}
                      {opt.label} ({cnt})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  anchor: {
    alignSelf: "flex-start"
  },
  anchorFull: {
    alignSelf: "stretch",
    width: "100%"
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 40,
    minWidth: 150,
    maxWidth: 180,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: posColors.border,
    backgroundColor: posColors.card
  },
  triggerFull: {
    maxWidth: "100%",
    width: "100%"
  },
  triggerPressed: {
    backgroundColor: posColors.cardHover,
    borderColor: posColors.primary
  },
  triggerPrefix: {
    fontSize: 13,
    fontWeight: "600",
    color: posColors.textDim
  },
  triggerValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: posColors.primary
  },
  chevron: {
    fontSize: 9,
    color: posColors.textDim,
    marginLeft: 2
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  menu: {
    position: "absolute",
    borderRadius: posRadius.lg,
    paddingVertical: posSpacing.sm,
    overflow: "hidden",
    zIndex: 1000
  },
  menuTitle: {
    ...posType.label,
    paddingHorizontal: posSpacing.md,
    paddingVertical: posSpacing.sm,
    color: posColors.textDim
  },
  menuScroll: {
    maxHeight: 320
  },
  menuItem: {
    paddingHorizontal: posSpacing.md,
    paddingVertical: 12,
    borderRadius: posRadius.md,
    marginHorizontal: posSpacing.xs
  },
  menuItemOn: {
    backgroundColor: posColors.primaryMuted
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: posColors.textSecondary
  },
  menuItemTextOn: {
    color: posColors.primary,
    fontWeight: "700"
  }
});
