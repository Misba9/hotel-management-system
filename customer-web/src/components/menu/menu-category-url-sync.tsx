"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MENU_ALL_CATEGORY_ID, useMenuCategory } from "@/context/menu-category-context";

/** Keeps selected category in sync with `?category=` when navigating from other routes. */
export function MenuCategoryUrlSync() {
  const searchParams = useSearchParams();
  const { setSelectedCategoryId } = useMenuCategory();
  const categoryParam = searchParams.get("category");

  useEffect(() => {
    const c = categoryParam?.trim();
    setSelectedCategoryId(c || MENU_ALL_CATEGORY_ID);
  }, [categoryParam, setSelectedCategoryId]);

  return null;
}
