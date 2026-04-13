import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta"
});

export const metadata: Metadata = {
  title: "Nausheen Fruits Juice Center",
  description: "Order fresh juices, shakes, smoothies, and fruit bowls online.",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    shortcut: "/favicon.ico",
    apple: "/favicon.ico"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${plusJakarta.variable} overflow-x-hidden bg-brand-background transition-colors`}
      >
        {/* Firebase Phone Auth invisible reCAPTCHA anchor — must exist before signInWithPhoneNumber (see getOrCreatePhoneRecaptchaVerifier). */}
        <div
          id="recaptcha-container"
          className="fixed bottom-0 left-0 z-[100] h-px w-px overflow-hidden opacity-0"
          aria-hidden
        />
        <ThemeProvider>
          <FirebaseConfigWarning />
          <ToastProvider>
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
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
