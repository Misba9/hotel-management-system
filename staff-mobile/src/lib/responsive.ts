import { Dimensions, PixelRatio } from "react-native";

/** Base design width (dp) — typical phone reference */
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/** Breakpoints (dp) — phone < 600, tablet 600–900, large tablet 900+ */
export const BREAKPOINTS = {
  phone: 0,
  tablet: 600,
  largeTablet: 900,
  /** Fine-grained phone sizing for typography */
  largePhone: 450
} as const;

export type ResponsiveTier = "phone" | "tablet" | "largeTablet";

let screenWidth = Dimensions.get("window").width;
let screenHeight = Dimensions.get("window").height;

Dimensions.addEventListener("change", ({ window }) => {
  screenWidth = window.width;
  screenHeight = window.height;
});

export function getScreenWidth() {
  return screenWidth;
}

export function getScreenHeight() {
  return screenHeight;
}

export function wp(percent: number, width = screenWidth) {
  return (width * percent) / 100;
}

export function hp(percent: number, height = screenHeight) {
  return (height * percent) / 100;
}

export function scale(size: number, width = screenWidth) {
  return (width / BASE_WIDTH) * size;
}

export function moderateScale(size: number, factor = 0.5, width = screenWidth) {
  return size + (scale(size, width) - size) * factor;
}

export function verticalScale(size: number, height = screenHeight) {
  return (height / BASE_HEIGHT) * size;
}

export function isPhone(width = screenWidth) {
  return width < BREAKPOINTS.tablet;
}

export function isLargePhone(width = screenWidth) {
  return width >= BREAKPOINTS.largePhone && width < BREAKPOINTS.tablet;
}

/** @deprecated Use isTablet — kept for existing imports */
export function isSmallTablet(width = screenWidth) {
  return isTablet(width) && !isLargeTablet(width);
}

export function isLargeTablet(width = screenWidth) {
  return width >= BREAKPOINTS.largeTablet;
}

export function isTablet(width = screenWidth) {
  return width >= BREAKPOINTS.tablet;
}

export function isLandscape(width = screenWidth, height = screenHeight) {
  return width > height;
}

export function getResponsiveTier(width = screenWidth): ResponsiveTier {
  if (width >= BREAKPOINTS.largeTablet) return "largeTablet";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "phone";
}

/** Horizontal screen padding: phone 12–16, tablet 20–24, large tablet 28–32 */
export function responsivePadding(width = screenWidth) {
  if (width >= BREAKPOINTS.largeTablet) return 28;
  if (width >= BREAKPOINTS.tablet) return 20;
  if (width >= BREAKPOINTS.largePhone) return 16;
  return 12;
}

/** Card radius: phone 12, tablet+ 16 */
export function responsiveRadius(width = screenWidth) {
  return width >= BREAKPOINTS.tablet ? 16 : 12;
}

/** Icon size: phone 20, tablet 24, large tablet 28 */
export function responsiveIconSize(width = screenWidth) {
  if (width >= BREAKPOINTS.largeTablet) return 28;
  if (width >= BREAKPOINTS.tablet) return 24;
  return 20;
}

/** Minimum touch target (48dp) */
export const MIN_TOUCH_TARGET = 48;

export function touchTarget(size: number) {
  return Math.max(size, MIN_TOUCH_TARGET);
}

/** Grid column count for cards/tables/metrics */
export function getGridColumnCount(
  width = screenWidth,
  opts: { phone?: number; tablet?: number; largeTablet?: number } = {}
) {
  const phone = opts.phone ?? 2;
  const tablet = opts.tablet ?? 3;
  const largeTablet = opts.largeTablet ?? 4;
  if (width >= BREAKPOINTS.largeTablet) return largeTablet;
  if (width >= BREAKPOINTS.tablet) return tablet;
  return phone;
}

/** Cell width for FlatList numColumns grids */
export function getGridCellWidth(
  width: number,
  columns: number,
  horizontalPadding = responsivePadding(width),
  gap = 10
) {
  const usable = width - horizontalPadding * 2 - gap * Math.max(0, columns - 1);
  return usable / Math.max(1, columns);
}

/** Metric card width as percentage string for flex-wrap grids */
export function getMetricCardBasis(width = screenWidth, gap = 10) {
  const columns = getGridColumnCount(width, { phone: 2, tablet: 3, largeTablet: 4 });
  const pct = (100 - (gap * (columns - 1)) / (width / 100)) / columns;
  return `${pct}%` as `${number}%`;
}

/** Login / auth form readable width on tablets (500–700px) */
export function getLoginFormMaxWidth(width = screenWidth) {
  if (width >= BREAKPOINTS.largeTablet) return Math.min(700, Math.max(500, wp(52, width)));
  if (width >= BREAKPOINTS.tablet) return Math.min(650, Math.max(500, wp(58, width)));
  return width;
}

/** Modal / dialog max width without letterboxing */
export function getDialogMaxWidth(width = screenWidth) {
  if (width >= BREAKPOINTS.largeTablet) return Math.min(560, wp(50, width));
  if (width >= BREAKPOINTS.tablet) return Math.min(480, wp(70, width));
  return width - responsivePadding(width) * 2;
}

/** Product grid column count — phone 2 / tablet 4–5 / large tablet 5–6 */
export function getProductGridColumns(width = screenWidth, landscape = isLandscape(width)) {
  if (width >= BREAKPOINTS.largeTablet) {
    if (width >= 1400) return 6;
    if (width >= 1100) return 5;
    return landscape ? 5 : 4;
  }
  if (width >= BREAKPOINTS.tablet) {
    return landscape || width >= 800 ? 5 : 4;
  }
  if (width >= BREAKPOINTS.largePhone || landscape) return 2;
  return 2;
}

/**
 * Three-panel POS flex weights (category | menu | bill).
 * Tablet: ~18% | 52% | 30%. Large tablet: ~18% | 54% | 28%. Desktop: ~17% | 58% | 25%.
 * Returns null on phone portrait (stacked / tabbed).
 */
export function getPosPanelFlex(width = screenWidth): { category: number; menu: number; bill: number } | null {
  if (!isTablet(width) && !isLandscape(width)) return null;
  if (width >= 1400) {
    return { category: 0.17, menu: 0.58, bill: 0.25 };
  }
  if (width >= BREAKPOINTS.largeTablet) {
    return { category: 0.18, menu: 0.54, bill: 0.28 };
  }
  if (width >= BREAKPOINTS.tablet) {
    return { category: 0.18, menu: 0.52, bill: 0.3 };
  }
  // Phone landscape: hide dedicated category column weight (chips on top)
  return { category: 0, menu: 0.62, bill: 0.38 };
}

/** @deprecated Prefer getPosPanelFlex — menu share of menu+bill when category is separate */
export function getBillSplitRatio(width = screenWidth) {
  const panels = getPosPanelFlex(width);
  if (!panels) return 1;
  const menuBill = panels.menu + panels.bill;
  return menuBill > 0 ? panels.menu / menuBill : 0.6;
}

/** Category sidebar width as percentage of screen (tablet+) */
export function getCategorySidebarWidth(width = screenWidth) {
  if (!isTablet(width)) return "100%" as const;
  if (width >= BREAKPOINTS.largeTablet) return wp(18, width);
  return wp(20, width);
}

/** Product card font sizes — name ~18, price ~24 on tablet */
export function productCardFonts(width = screenWidth) {
  const tier = getResponsiveTier(width);
  if (tier === "largeTablet") {
    return { title: 18, price: 24, category: 13, stock: 12, qty: 16 };
  }
  if (tier === "tablet") {
    return { title: 17, price: 22, category: 12, stock: 11, qty: 15 };
  }
  return { title: 15, price: 18, category: 11, stock: 10, qty: 14 };
}

/** Respect system font scale for accessibility */
export function scaledFontSize(size: number) {
  return Math.round(PixelRatio.roundToNearestPixel(size * PixelRatio.getFontScale()));
}

/**
 * Responsive type scale:
 * phone 14–16 body / tablet 16–18 / large tablet 18–22
 * titles scale one step above body.
 */
export function responsiveFonts(width = screenWidth) {
  const tier = getResponsiveTier(width);
  if (tier === "largeTablet") {
    return { body: 18, bodyLarge: 20, title: 28, subtitle: 18, caption: 14, button: 17 };
  }
  if (tier === "tablet") {
    return { body: 16, bodyLarge: 18, title: 24, subtitle: 16, caption: 13, button: 16 };
  }
  return { body: 14, bodyLarge: 16, title: 22, subtitle: 14, caption: 12, button: 15 };
}

/** Button min height: phone 48 / tablet 52 / large tablet 56 */
export function responsiveButtonHeight(width = screenWidth) {
  if (width >= BREAKPOINTS.largeTablet) return 56;
  if (width >= BREAKPOINTS.tablet) return 52;
  return 48;
}

/** Order source bar: equal tab width on tablet */
export function getOrderTabFlex(width = screenWidth) {
  return isTablet(width) ? 1 : undefined;
}
