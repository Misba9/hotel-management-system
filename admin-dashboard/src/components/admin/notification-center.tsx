"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChefHat, CreditCard, Package, Users, Warehouse, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type NotificationItem = {
  id: string;
  category: "inventory" | "orders" | "payments" | "kitchen" | "staff" | "customers";
  title: string;
  message: string;
  time: string;
  unread?: boolean;
};

const categoryIcons = {
  inventory: Warehouse,
  orders: Package,
  payments: CreditCard,
  kitchen: ChefHat,
  staff: Users,
  customers: Users
};

const mockNotifications: NotificationItem[] = [
  {
    id: "1",
    category: "inventory",
    title: "Low stock alert",
    message: "Chicken stock will finish in 3 hours",
    time: "2m ago",
    unread: true
  },
  {
    id: "2",
    category: "orders",
    title: "New order",
    message: "Table 7 placed order #1042 — Rs. 1,240",
    time: "5m ago",
    unread: true
  },
  {
    id: "3",
    category: "kitchen",
    title: "Order delayed",
    message: "Order #1038 exceeded prep time by 8 min",
    time: "12m ago",
    unread: true
  },
  {
    id: "4",
    category: "payments",
    title: "Payment received",
    message: "UPI payment Rs. 890 confirmed for #1035",
    time: "18m ago"
  },
  {
    id: "5",
    category: "staff",
    title: "Shift change",
    message: "Rajesh clocked in for evening shift",
    time: "25m ago"
  }
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NotificationCenter({ open, onClose }: Props) {
  const [notifications, setNotifications] = useState(mockNotifications);
  const unreadCount = notifications.filter((n) => n.unread).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close notifications"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-surface-raised/95 shadow-glass backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Notifications</h2>
                <p className="text-xs text-white/40">{unreadCount} unread</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-medium text-brand-primary hover:text-brand-secondary"
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-4 py-2">
              {(["all", "inventory", "orders", "payments", "kitchen"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium capitalize text-white/50 hover:bg-white/5 hover:text-white"
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {notifications.map((n) => {
                const Icon = categoryIcons[n.category];
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "mb-2 flex gap-3 rounded-xl border p-3 transition-colors hover:bg-white/[0.03]",
                      n.unread ? "border-brand-primary/20 bg-brand-muted/50" : "border-white/[0.06]"
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
                      <Icon className="h-4 w-4 text-brand-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{n.title}</p>
                        {n.unread ? <Badge variant="default">New</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-white/50">{n.message}</p>
                      <p className="mt-1 text-[10px] text-white/30">{n.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function NotificationBell({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-xl p-2.5 text-white/60 transition hover:bg-white/5 hover:text-white"
      aria-label="Open notifications"
    >
      <Bell className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-bold text-white ring-2 ring-surface">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}
