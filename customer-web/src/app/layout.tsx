import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { Footer } from "@/components/layout/footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { FavoritesProvider } from "@/components/providers/favorites-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";

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
  description: "Order fresh juices, shakes, smoothies, and fruit bowls online."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${plusJakarta.variable} bg-brand-background transition-colors`}>
        <ThemeProvider>
          <ToastProvider>
            <CartProvider>
              <FavoritesProvider>
                <AppShell>
                  {children}
                  <Footer />
                </AppShell>
              </FavoritesProvider>
            </CartProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
