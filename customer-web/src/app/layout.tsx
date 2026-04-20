import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";

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
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${plusJakarta.variable} overflow-x-hidden bg-brand-background transition-colors`}
      >
        <div
          id="recaptcha-container"
          className="fixed bottom-0 left-0 z-[100] h-px w-px overflow-hidden opacity-0"
          aria-hidden
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
