import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DesktopAppShell } from "@/components/DesktopAppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useWaiterMenu } from "@/hooks/use-waiter-menu";
import { useTables } from "@/hooks/use-tables";
import { confirmRestaurantOrder, printRestaurantReceipt, type CartLine } from "@/services/restaurant-orders";

function formatPrice(n: number) {
  return `₹${n.toFixed(2)}`;
}

export function WaiterOrderPage() {
  const { tableId = "" } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { items: products, loading } = useWaiterMenu(true);
  const { tables } = useTables(true);
  const table = useMemo(() => tables.find((t) => t.id === tableId) ?? null, [tables, tableId]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const total = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.qty, 0), [cart]);

  const addItem = (p: { id: string; name: string; price: number }) => {
    setCart((prev) => {
      const ex = prev.find((l) => l.productId === p.id);
      if (ex) return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { productId: p.id, name: p.name, unitPrice: p.price, qty: 1 }];
    });
  };

  const confirmOrder = async () => {
    if (!table || cart.length === 0) return;
    setBusy(true);
    try {
      const placed = await confirmRestaurantOrder({
        tableFirestoreId: table.id,
        tableNumber: table.number,
        tableDisplayName: table.displayName,
        lines: cart,
        linkTable: true
      });
      await printRestaurantReceipt({
        tokenNumber: placed.tokenNumber,
        tableNumber: placed.tableNumber,
        tableLabel: placed.tableLabel,
        items: placed.items,
        total: placed.total
      });
      setMessage(`Order #${placed.tokenNumber} sent to kitchen`);
      setCart([]);
      setTimeout(() => navigate("/waiter"), 1500);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DesktopAppShell
      title={table ? `Order · ${table.displayName ?? `Table ${table.number}`}` : "Table order"}
      subtitle="Add items and confirm to kitchen"
      onLogout={() => void logout()}
    >
      <div className="flex h-full min-h-0">
        <main className="flex-1 overflow-y-auto p-5">
          {message ? <p className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{message}</p> : null}
          {loading ? (
            <p className="text-slate-400">Loading menu…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              {products.map((p: { id: string; name: string; price: number }) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem({ id: p.id, name: p.name, price: p.price })}
                  className="rounded-2xl border bg-white p-4 text-left shadow-sm hover:border-brand-teal/40 dark:border-slate-700 dark:bg-slate-900"
                >
                  <p className="font-bold">{p.name}</p>
                  <p className="text-brand-teal">{formatPrice(p.price)}</p>
                </button>
              ))}
            </div>
          )}
        </main>
        <aside className="flex w-[360px] shrink-0 flex-col border-l bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b p-4 font-bold dark:border-slate-800">Cart ({cart.length})</div>
          <div className="flex-1 overflow-y-auto p-3">
            {cart.map((line) => (
              <div key={line.productId} className="mb-2 flex justify-between text-sm">
                <span>{line.qty}× {line.name}</span>
                <span>{formatPrice(line.unitPrice * line.qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t p-4 dark:border-slate-800">
            <p className="mb-3 text-xl font-extrabold text-brand-teal">{formatPrice(total)}</p>
            <button type="button" disabled={busy || cart.length === 0} onClick={() => void confirmOrder()} className="w-full rounded-xl bg-brand-teal py-3 font-bold text-white disabled:opacity-50">
              Confirm to kitchen
            </button>
          </div>
        </aside>
      </div>
    </DesktopAppShell>
  );
}
