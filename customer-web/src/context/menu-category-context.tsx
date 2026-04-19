"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export const MENU_ALL_CATEGORY_ID = "all" as const;

type MenuCategoryContextValue = {
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
};

const MenuCategoryContext = createContext<MenuCategoryContextValue | null>(null);

export function MenuCategoryProvider({ children }: { children: ReactNode }) {
  const [selectedCategoryId, setSelectedCategoryIdState] = useState<string>(MENU_ALL_CATEGORY_ID);

  const setSelectedCategoryId = useCallback((id: string) => {
    setSelectedCategoryIdState(id.trim() || MENU_ALL_CATEGORY_ID);
  }, []);

  const value = useMemo(
    () => ({ selectedCategoryId, setSelectedCategoryId }),
    [selectedCategoryId, setSelectedCategoryId]
  );

  return <MenuCategoryContext.Provider value={value}>{children}</MenuCategoryContext.Provider>;
}

export function useMenuCategory() {
  const ctx = useContext(MenuCategoryContext);
  if (!ctx) {
    throw new Error("useMenuCategory must be used within MenuCategoryProvider");
  }
  return ctx;
}
