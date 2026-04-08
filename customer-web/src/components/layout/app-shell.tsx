"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { FloatingCartButton } from "@/components/cart/floating-cart-button";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Navbar } from "@/components/layout/navbar";
import { FcmBootstrap } from "@/components/notifications/fcm-bootstrap";
import { RealtimeOrderNotifier } from "@/components/notifications/realtime-order-notifier";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <Navbar />
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-24 pt-3 sm:px-6 md:pb-8 md:pt-6 lg:px-8"
      >
        {children}
      </motion.main>
      <FloatingCartButton />
      <CartDrawer />
      <FcmBootstrap />
      <RealtimeOrderNotifier />
      <MobileBottomNav />
    </>
  );
}
