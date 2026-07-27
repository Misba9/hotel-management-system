import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import {
  BREAKPOINTS,
  getBillSplitRatio,
  getCategorySidebarWidth,
  getGridColumnCount,
  getLoginFormMaxWidth,
  getPosPanelFlex,
  getProductGridColumns,
  getResponsiveTier,
  hp,
  isLandscape,
  isLargePhone,
  isLargeTablet,
  isPhone,
  isSmallTablet,
  isTablet,
  moderateScale,
  productCardFonts,
  responsiveButtonHeight,
  responsiveFonts,
  responsiveIconSize,
  responsivePadding,
  responsiveRadius,
  scale,
  touchTarget,
  wp,
  type ResponsiveTier
} from "../lib/responsive";

export type ResponsiveLayout = {
  width: number;
  height: number;
  tier: ResponsiveTier;
  isPhone: boolean;
  isLargePhone: boolean;
  isSmallTablet: boolean;
  isLargeTablet: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  /** Show products + bill side-by-side */
  showSplitBill: boolean;
  /** Full-screen bill on phone portrait */
  showMobileBillTabs: boolean;
  /** Three-panel POS flex (null on phone portrait) */
  posPanels: { category: number; menu: number; bill: number } | null;
  productColumns: number;
  gridColumns: number;
  billSplitRatio: number;
  categorySidebarWidth: number | "100%";
  padding: number;
  radius: number;
  iconSize: number;
  minTouch: number;
  buttonHeight: number;
  fonts: ReturnType<typeof responsiveFonts>;
  loginFormMaxWidth: number;
  productFonts: ReturnType<typeof productCardFonts>;
  wp: (percent: number) => number;
  hp: (percent: number) => number;
  scale: (size: number) => number;
  moderateScale: (size: number, factor?: number) => number;
};

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const landscape = isLandscape(width, height);
    const phone = isPhone(width);
    const tablet = isTablet(width);
    const largeTablet = isLargeTablet(width);
    const splitBill = landscape || tablet;
    const posPanels = getPosPanelFlex(width);

    return {
      width,
      height,
      tier: getResponsiveTier(width),
      isPhone: phone,
      isLargePhone: isLargePhone(width),
      isSmallTablet: isSmallTablet(width),
      isLargeTablet: largeTablet,
      isTablet: tablet,
      isLandscape: landscape,
      isPortrait: !landscape,
      showSplitBill: splitBill,
      showMobileBillTabs: phone && !landscape,
      posPanels,
      productColumns: getProductGridColumns(width, landscape),
      gridColumns: getGridColumnCount(width),
      billSplitRatio: getBillSplitRatio(width),
      categorySidebarWidth: getCategorySidebarWidth(width),
      padding: responsivePadding(width),
      radius: responsiveRadius(width),
      iconSize: responsiveIconSize(width),
      minTouch: touchTarget(48),
      buttonHeight: responsiveButtonHeight(width),
      fonts: responsiveFonts(width),
      loginFormMaxWidth: getLoginFormMaxWidth(width),
      productFonts: productCardFonts(width),
      wp: (percent: number) => wp(percent, width),
      hp: (percent: number) => hp(percent, height),
      scale: (size: number) => scale(size, width),
      moderateScale: (size: number, factor = 0.5) => moderateScale(size, factor, width)
    };
  }, [width, height]);
}

export { BREAKPOINTS };
