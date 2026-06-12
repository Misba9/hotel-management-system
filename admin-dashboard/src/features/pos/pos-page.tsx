"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Barcode,
  CreditCard,
  Minus,
  Pause,
  Plus,
  Printer,
  Search,
  Send,
  ShoppingCart,
  Smartphone,
  Trash2,
  User,
  Wallet
} from "lucide-react";
import { useCategories } from "@/features/menu/hooks/use-categories";
import { useProducts } from "@/features/menu/hooks/use-products";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { MetricSkeletonGrid } from "@/components/ui/skeleton";

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

export function PosPageFeature() {
  const { categories, loading: catLoading } = useCategories();
  const { items: products, loading: prodLoading } = useProducts();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [heldBills] = useState([{ id: "H-001", total: 1240, items: 3 }]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory !== "all") list = list.filter((p) => p.categoryId === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, search]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  function addToCart(id: string, name: string, price: number) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id, name, price, qty: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  }

  const loading = catLoading || prodLoading;

  return (
    <PageShell badge="Point of Sale" title="Premium POS" description="Fast billing · split · hold · kitchen sync">
      {loading ? (
        <MetricSkeletonGrid count={4} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          {/* Categories */}
          <GlassCard className="lg:col-span-2 p-3" hover={false}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Categories</p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  activeCategory === "all" ? "bg-brand-muted text-brand-primary" : "text-white/60 hover:bg-white/5"
                }`}
              >
                All Items
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    activeCategory === c.id ? "bg-brand-muted text-brand-primary" : "text-white/60 hover:bg-white/5"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Products */}
          <GlassCard className="lg:col-span-7 p-4" hover={false}>
            <div className="mb-4 flex flex-wrap gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Button variant="secondary" size="sm">
                <Barcode className="h-4 w-4" />
                Scan
              </Button>
              <Button variant="secondary" size="sm">
                Quick Discount
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((p, i) => (
                  <motion.button
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.02 }}
                    type="button"
                    onClick={() => addToCart(p.id, p.name, p.price)}
                    className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:border-brand-primary/30 hover:bg-brand-muted/30"
                  >
                    <div className="mb-2 aspect-square overflow-hidden rounded-lg bg-white/5">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-white/20">
                          <ShoppingCart className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <p className="truncate text-sm font-medium text-white">{p.name}</p>
                    <p className="mt-0.5 text-sm font-semibold text-brand-primary">{formatCurrency(p.price)}</p>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </GlassCard>

          {/* Cart */}
          <GlassCard className="lg:col-span-3 flex flex-col p-4" hover={false}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">Current Bill</h3>
              <Badge variant="neutral">{cart.length} items</Badge>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {["Split", "Merge", "Hold", "Resume", "Note"].map((action) => (
                <Button key={action} variant="ghost" size="sm" className="text-[11px]">
                  {action}
                </Button>
              ))}
            </div>

            <Button variant="secondary" size="sm" className="mb-3 w-full">
              <User className="h-4 w-4" />
              Select Customer
            </Button>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/30">Tap products to add</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{item.name}</p>
                      <p className="text-xs text-white/40">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateQty(item.id, -1)} className="rounded-lg p-1 hover:bg-white/10">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">{item.qty}</span>
                      <button type="button" onClick={() => updateQty(item.id, 1)} className="rounded-lg p-1 hover:bg-white/10">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {heldBills.length > 0 ? (
              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2">
                <p className="text-[10px] font-semibold uppercase text-amber-400">Held Bills</p>
                {heldBills.map((h) => (
                  <button key={h.id} type="button" className="mt-1 flex w-full items-center justify-between text-xs text-white/70 hover:text-white">
                    <span className="flex items-center gap-1">
                      <Pause className="h-3 w-3" />
                      {h.id}
                    </span>
                    <span>{formatCurrency(h.total)}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4 space-y-1 border-t border-white/[0.06] pt-3 text-sm">
              <div className="flex justify-between text-white/50">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Tax (5%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-white">
                <span>Total</span>
                <span className="text-brand-primary">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm">
                <Send className="h-4 w-4" />
                Kitchen
              </Button>
              <Button variant="secondary" size="sm">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
            <Button className="mt-2 w-full" disabled={cart.length === 0} onClick={() => setPaymentOpen(true)}>
              Pay {formatCurrency(total)}
            </Button>
            {cart.length > 0 ? (
              <Button variant="ghost" size="sm" className="mt-1 w-full text-rose-400" onClick={() => setCart([])}>
                <Trash2 className="h-4 w-4" />
                Clear Cart
              </Button>
            ) : null}
          </GlassCard>
        </div>
      )}

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
          </DialogHeader>
          <p className="text-3xl font-bold text-brand-primary">{formatCurrency(total)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: "Cash", icon: Wallet },
              { label: "Card", icon: CreditCard },
              { label: "UPI", icon: Smartphone },
              { label: "Wallet", icon: Wallet }
            ].map(({ label, icon: Icon }) => (
              <Button key={label} variant="secondary" className="h-16 flex-col gap-1" onClick={() => setPaymentOpen(false)}>
                <Icon className="h-5 w-5 text-brand-primary" />
                {label}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
