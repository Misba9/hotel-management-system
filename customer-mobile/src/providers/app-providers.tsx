import { QueryProvider } from "@/src/providers/query-provider";
import { AuthProvider } from "@/src/context/auth-context";
import { CartProvider } from "@/src/context/cart-context";
import { FavoritesProvider } from "@/src/context/favorites-context";
import { ToastProvider } from "@/src/context/toast-context";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>
          <CartProvider>
            <FavoritesProvider>{children}</FavoritesProvider>
          </CartProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
