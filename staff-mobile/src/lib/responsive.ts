import { Dimensions, PixelRatio } from "react-native";

/** Base design width (dp) — typical phone reference */
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/** Breakpoints (dp) — phone < 768, tablet >= 768, large tablet/desktop >= 1024 */
export const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  largeTablet: 1024,
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

/** Horizontal screen padding: phone 16, tablet 24, large tablet 32 */
export function responsivePadding(width = screenWidth) {
  if (width >= BREAKPOINTS.largeTablet) return 32;
  if (width >= BREAKPOINTS.tablet) return 24;
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

/** Product grid column count */
export function getProductGridColumns(width = screenWidth, landscape = isLandscape(width)) {
  if (width >= BREAKPOINTS.largeTablet) {
    if (width >= 1400) return 6;
    if (width >= 1200) return 5;
    return 4;
  }
  if (width >= BREAKPOINTS.tablet) return 3;
  if (width >= BREAKPOINTS.largePhone || landscape) return 2;
  return 1;
}

/** Bill panel flex ratio (products side) */
export function getBillSplitRatio(width = screenWidth) {
  if (width >= BREAKPOINTS.largeTablet) return 0.65;
  if (width >= BREAKPOINTS.tablet) return 0.6;
  if (isLandscape(width)) return 0.6;
  return 1;
}

/** Category sidebar width as percentage of screen */
export function getCategorySidebarWidth(width = screenWidth) {
  if (!isTablet(width)) return "100%" as const;
  if (width >= BREAKPOINTS.largeTablet) return wp(18, width);
  return wp(22, width);
}

/** Product card font sizes */
export function productCardFonts(width = screenWidth) {
  const tablet = width >= BREAKPOINTS.tablet;
  return {
    title: moderateScale(tablet ? 20 : 16, 0.3, width),
    price: moderateScale(tablet ? 28 : 22, 0.3, width),
    category: moderateScale(tablet ? 15 : 12, 0.3, width),
    stock: moderateScale(tablet ? 11 : 9, 0.3, width),
    qty: moderateScale(tablet ? 17 : 15, 0.3, width)
  };
}

/** Respect system font scale for accessibility */
export function scaledFontSize(size: number) {
  return Math.round(PixelRatio.roundToNearestPixel(size * PixelRatio.getFontScale()));
}

/** Order source bar: equal tab width on tablet */
export function getOrderTabFlex(width = screenWidth) {
  return isTablet(width) ? 1 : undefined;
}
