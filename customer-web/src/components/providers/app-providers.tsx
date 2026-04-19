"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Footer } from "@/components/layout/footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { DeliveryAddressProvider } from "@/context/delivery-address-context";
import { FavoritesProvider } from "@/components/providers/favorites-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { AuthProvider } from "@/context/auth-context";
import { UserProfileProvider } from "@/context/user-profile-context";
import { FirebaseConfigWarning } from "@/components/auth/firebase-config-warning";
import { AppCheckBootstrap } from "@/components/providers/app-check-bootstrap";
import { GoogleMapsScriptProvider } from "@/components/providers/google-maps-script";

/**
 * Client-only tree: theme, auth, cart, and shell. Keeps `app/layout.tsx` a small server entry.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AppCheckBootstrap />
      <FirebaseConfigWarning />
      <ToastProvider>
        <GoogleMapsScriptProvider>
          <QueryProvider>
            <AuthProvider>
              <UserProfileProvider>
                <CartProvider>
                  <DeliveryAddressProvider>
                    <FavoritesProvider>
                      <AppShell>
                        {children}
                        <Footer />
                      </AppShell>
                    </FavoritesProvider>
                  </DeliveryAddressProvider>
                </CartProvider>
              </UserProfileProvider>
            </AuthProvider>
          </QueryProvider>
        </GoogleMapsScriptProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
