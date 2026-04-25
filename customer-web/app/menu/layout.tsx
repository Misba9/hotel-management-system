import type { ReactNode } from "react";
import { MenuCategoryProvider } from "@/context/menu-category-context";

export default function MenuLayout({ children }: { children: ReactNode }) {
  return <MenuCategoryProvider>{children}</MenuCategoryProvider>;
}
