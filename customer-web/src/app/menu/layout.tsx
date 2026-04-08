import { MenuCategoryProvider } from "@/context/menu-category-context";

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return <MenuCategoryProvider>{children}</MenuCategoryProvider>;
}
