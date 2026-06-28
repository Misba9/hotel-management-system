import { useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { hasManagerOperationalAccess } from "@shared/utils/manager-permissions";
import { homePathForRole } from "@/lib/role-routes";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import type { MenuProduct } from "@/services/products";
import type { StaffOrderRow } from "@/services/orders";
import type { ManagerNavItem, ManagerNavKey, StaffDirectoryRow } from "./types";
import { useManagerModuleData } from "./use-manager-module-data";
import { ManagerModuleShell } from "./manager-module-shell";
import { ManagerOrderManagement } from "./manager-order-management";
import { ManagerTableManagement } from "./manager-table-management";
import { ManagerKitchenMonitor } from "./manager-kitchen-monitor";
import { ManagerBillingMonitor } from "./manager-billing-monitor";
import { ManagerStaffManagement } from "./manager-staff-management";
import { ManagerInventoryMonitor } from "./manager-inventory-monitor";
import { ManagerReportsModule } from "./manager-reports-module";
import { ManagerNotificationCenter } from "./manager-notification-center";
import { ManagerSettings } from "./manager-settings";

const NAV_ITEMS: ManagerNavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊", description: "Live operational overview" },
  { key: "orders", label: "Orders", icon: "📦", description: "Track and monitor order flow" },
  { key: "tables", label: "Tables", icon: "🍽️", description: "Occupancy and floor readiness" },
  { key: "kitchen", label: "Kitchen", icon: "👨‍🍳", description: "Preparation queue performance" },
  { key: "billing", label: "Billing", icon: "🧾", description: "Revenue and payment status" },
  { key: "customers", label: "Customers", icon: "🧑‍💼", description: "Customer frequency and spend" },
  { key: "inventory", label: "Inventory", icon: "📚", description: "Menu readiness and availability" },
  { key: "staff", label: "Staff", icon: "🧑‍🤝‍🧑", description: "Role and activation status" },
  { key: "reports", label: "Reports", icon: "📈", description: "Daily and weekly performance" },
  { key: "notifications", label: "Notifications", icon: "🔔", description: "Critical operational alerts" },
  { key: "settings", label: "Settings", icon: "⚙️", description: "Manager workspace preferences" }
];

const MONEY_FORMATTER = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function formatMoney(value: number): string {
  return `₹${MONEY_FORMATTER.format(Math.max(0, value))}`;
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function dateFromUnknown(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate() as Date;
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function currentNav(pathname: string): ManagerNavKey {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[1] ?? "dashboard";
  const match = NAV_ITEMS.find((item) => item.key === last);
  return match?.key ?? "dashboard";
}

function safeStatus(order: StaffOrderRow): string {
  const raw = (order.canonicalStatus || order.status || "").toString().trim().toLowerCase();
  return raw || "unknown";
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="rounded-2xl border border-theme-border bg-theme-card p-4 shadow-card">
      <p className="text-xs uppercase tracking-wide text-theme-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-theme-text-primary">{value}</p>
      {detail ? <p className="mt-1 text-xs text-theme-text-disabled">{detail}</p> : null}
    </article>
  );
}

function SectionCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <h3 className="text-base font-bold text-theme-text-primary">{title}</h3>
        <p className="text-xs text-theme-text-secondary">{description}</p>
      </header>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

function statusChip(status: string): string {
  if (status === "new") return "bg-amber-500/20 text-amber-300";
  if (status === "accepted") return "bg-sky-500/20 text-sky-300";
  if (status === "preparing") return "bg-indigo-500/20 text-indigo-300";
  if (status === "ready") return "bg-emerald-500/20 text-emerald-300";
  if (status === "completed" || status === "delivered") return "bg-green-600/20 text-green-300";
  if (status === "cancelled") return "bg-red-600/20 text-red-300";
  return "bg-theme-hover text-theme-text-secondary";
}

type DashboardStats = {
  totalRevenue: number;
  todayRevenue: number;
  todayOrders: number;
  activeOrders: number;
  totalOrders: number;
  avgTicket: number;
  occupiedTables: number;
  availableTables: number;
  pendingBills: number;
  onlineOrders: number;
  swiggyOrders: number;
  zomatoOrders: number;
  kitchenQueue: number;
  availableProducts: number;
  activeStaff: number;
};

function computeStats(
  orders: StaffOrderRow[],
  tables: { status: string }[],
  products: MenuProduct[],
  staff: StaffDirectoryRow[]
): DashboardStats {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let totalRevenue = 0;
  let todayRevenue = 0;
  let todayOrders = 0;
  let paidOrders = 0;
  let activeOrders = 0;
  let pendingBills = 0;
  let onlineOrders = 0;
  let swiggyOrders = 0;
  let zomatoOrders = 0;
  let kitchenQueue = 0;

  for (const order of orders) {
    const total = Number(order.totalAmount ?? 0);
    const normalizedStatus = safeStatus(order);
    const paymentStatus = (order.paymentStatus ?? "").toString().toLowerCase();
    const createdAt = dateFromUnknown(order.createdAt);
    const source = (order.source ?? "").toLowerCase();
    const orderType = (order.orderType ?? "").toLowerCase();
    if (paymentStatus === "paid" || normalizedStatus === "completed" || normalizedStatus === "delivered") {
      totalRevenue += total;
      paidOrders += 1;
      if (createdAt && createdAt >= now) {
        todayRevenue += total;
      }
    }
    if (createdAt && createdAt >= now) {
      todayOrders += 1;
    }
    if (["new", "accepted", "preparing", "ready"].includes(normalizedStatus)) {
      activeOrders += 1;
    }
    if (["new", "accepted", "preparing", "ready"].includes(normalizedStatus)) {
      kitchenQueue += 1;
    }
    if (paymentStatus !== "paid" && normalizedStatus !== "cancelled") {
      pendingBills += 1;
    }
    if (
      orderType === "online" ||
      source === "online" ||
      source === "website" ||
      source === "swiggy" ||
      source === "zomato"
    ) {
      onlineOrders += 1;
    }
    if (source === "swiggy") swiggyOrders += 1;
    if (source === "zomato") zomatoOrders += 1;
  }

  const occupiedTables = tables.filter((t) => {
    const s = t.status.toLowerCase();
    return s === "occupied" || s === "reserved";
  }).length;

  return {
    totalRevenue,
    todayRevenue,
    todayOrders,
    activeOrders,
    totalOrders: orders.length,
    avgTicket: paidOrders > 0 ? Math.round(totalRevenue / paidOrders) : 0,
    occupiedTables,
    availableTables: Math.max(0, tables.length - occupiedTables),
    pendingBills,
    onlineOrders,
    swiggyOrders,
    zomatoOrders,
    kitchenQueue,
    availableProducts: products.filter((p) => p.availability).length,
    activeStaff: staff.filter((s) => s.isActive).length
  };
}

function QuickActionButton({
  label,
  onClick,
  tone = "default"
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        tone === "primary"
          ? "bg-theme-primary text-white hover:brightness-110"
          : "border border-theme-border bg-theme-card text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text-primary"
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function OrderStatRow({
  label,
  value,
  max
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-theme-text-secondary">{label}</span>
        <span className="font-semibold text-theme-text-primary">{value}</span>
      </div>
      <div className="h-2 rounded bg-theme-hover">
        <div className="h-2 rounded bg-theme-primary transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

export function ManagerDesktopModule() {
  const { role, logout, profile } = useAuth();
  const { status, syncNow } = useOfflineSync();
  const { orders, tables, products, staff, loading, errors, lastUpdated } = useManagerModuleData();
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = currentNav(location.pathname);

  if (!hasManagerOperationalAccess(role)) {
    return <Navigate to={homePathForRole(role ?? "cashier")} replace />;
  }

  const stats = useMemo(() => computeStats(orders, tables, products, staff), [orders, tables, products, staff]);
  const pendingOrders = useMemo(
    () => orders.filter((order) => ["new", "accepted", "preparing", "ready"].includes(safeStatus(order))),
    [orders]
  );
  const recentOrders = useMemo(() => orders.slice(0, 20), [orders]);
  const recentActivity = useMemo(
    () =>
      orders
        .slice(0, 12)
        .map((order) => ({
          id: order.id,
          token: order.tokenNumber ?? null,
          status: safeStatus(order),
          source: (order.source ?? order.orderType ?? "direct").toString().toLowerCase(),
          createdAt: dateFromUnknown(order.createdAt),
          amount: Number(order.totalAmount ?? 0)
        })),
    [orders]
  );
  const kitchenQueue = useMemo(
    () =>
      orders
        .filter((order) => ["new", "accepted", "preparing", "ready"].includes(safeStatus(order)))
        .slice(0, 15),
    [orders]
  );
  const pendingPayments = useMemo(
    () =>
      orders.filter((order) => {
        const st = safeStatus(order);
        return (order.paymentStatus ?? "").toLowerCase() !== "paid" && st !== "cancelled";
      }),
    [orders]
  );
  const customers = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; spend: number; lastOrder: Date | null }>();
    for (const order of orders) {
      const phone = (order.customerPhone ?? "").trim();
      const name = (order.customerName ?? "").trim() || "Walk-in";
      const key = phone || name;
      const entry = map.get(key) ?? { name, orders: 0, spend: 0, lastOrder: null };
      entry.orders += 1;
      entry.spend += Number(order.totalAmount ?? 0);
      const created = dateFromUnknown(order.createdAt);
      if (created && (!entry.lastOrder || created > entry.lastOrder)) {
        entry.lastOrder = created;
      }
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend).slice(0, 15);
  }, [orders]);
  const liveOrderStats = useMemo(() => {
    const statsByStatus = new Map<string, number>();
    for (const order of pendingOrders) {
      const key = safeStatus(order);
      statsByStatus.set(key, (statsByStatus.get(key) ?? 0) + 1);
    }
    return [
      { label: "New", value: statsByStatus.get("new") ?? 0 },
      { label: "Accepted", value: statsByStatus.get("accepted") ?? 0 },
      { label: "Preparing", value: statsByStatus.get("preparing") ?? 0 },
      { label: "Ready", value: statsByStatus.get("ready") ?? 0 }
    ];
  }, [pendingOrders]);

  const notifications = useMemo(() => {
    const list: Array<{ title: string; detail: string; severity: "high" | "medium" | "low" }> = [];
    const staleKitchen = kitchenQueue.find((order) => {
      const created = dateFromUnknown(order.createdAt);
      if (!created) return false;
      return Date.now() - created.getTime() > 25 * 60 * 1000;
    });
    if (pendingOrders.length > 0) {
      list.push({
        title: `${pendingOrders.length} active orders`,
        detail: "Orders are waiting for completion across cashier and kitchen flows.",
        severity: "medium"
      });
    }
    if (pendingPayments.length > 0) {
      list.push({
        title: `${pendingPayments.length} unpaid orders`,
        detail: "Review pending payment orders to avoid delayed settlement.",
        severity: "high"
      });
    }
    if (status.pendingCount > 0) {
      list.push({
        title: `${status.pendingCount} offline sync actions`,
        detail: "Device has queued writes that still need cloud sync.",
        severity: "high"
      });
    }
    if (products.some((p) => !p.availability)) {
      const unavailable = products.filter((p) => !p.availability).length;
      list.push({
        title: `${unavailable} products unavailable`,
        detail: "Inventory availability is reducing visible menu items for ordering.",
        severity: "medium"
      });
    }
    if (staleKitchen) {
      list.push({
        title: "Kitchen queue delay detected",
        detail: `Order #${staleKitchen.id.slice(-6)} has remained open for more than 25 minutes.`,
        severity: "high"
      });
    }
    return list;
  }, [kitchenQueue, pendingOrders.length, pendingPayments.length, products, status.pendingCount]);

  function go(key: ManagerNavKey) {
    navigate(key === "dashboard" ? "/manager" : `/manager/${key}`);
  }

  return (
    <ManagerModuleShell
      navItems={NAV_ITEMS}
      activeKey={activeKey}
      onNavigate={go}
      onLogout={() => void logout()}
      pendingNotifications={notifications.length}
    >
      {loading ? (
        <SectionCard title="Loading manager module" description="Preparing live dashboards and operational streams">
          <p className="text-sm text-theme-text-secondary">Fetching orders, floor tables, products, and staff roster…</p>
        </SectionCard>
      ) : null}

      {!loading && errors.length > 0 ? (
        <SectionCard title="Data source warnings" description="Some streams failed to load; the module remains operational">
          <ul className="space-y-2 text-sm text-theme-warning">
            {errors.map((err) => (
              <li key={err} className="rounded-lg bg-theme-warning-muted px-3 py-2">
                {err}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {!loading && activeKey === "dashboard" ? (
        <div className="space-y-5">
          <SectionCard title="Live Manager Dashboard" description="Realtime operational intelligence from current order streams">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <p className="text-theme-text-secondary">
                Realtime updates:{" "}
                <span className="font-semibold text-emerald-400">Connected</span>
              </p>
              <p className="text-theme-text-secondary">
                Last update:{" "}
                <span className="font-semibold text-theme-text-primary">
                  {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                </span>
              </p>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricTile label="Today's Sales" value={formatMoney(stats.todayRevenue)} detail="Settled today" />
            <MetricTile label="Today's Orders" value={String(stats.todayOrders)} detail="Created today" />
            <MetricTile label="Kitchen Queue" value={String(stats.kitchenQueue)} detail="New to ready" />
            <MetricTile label="Occupied Tables" value={String(stats.occupiedTables)} detail="Live floor load" />
            <MetricTile label="Available Tables" value={String(stats.availableTables)} detail="Ready for seating" />
            <MetricTile label="Pending Bills" value={String(stats.pendingBills)} detail="Not paid yet" />
            <MetricTile label="Online Orders" value={String(stats.onlineOrders)} detail="All online channels" />
            <MetricTile label="Swiggy Orders" value={String(stats.swiggyOrders)} detail="Source tagged swiggy" />
            <MetricTile label="Zomato Orders" value={String(stats.zomatoOrders)} detail="Source tagged zomato" />
            <MetricTile label="Staff On Duty" value={String(stats.activeStaff)} detail="Active staff accounts" />
          </div>

          <SectionCard title="Quick Actions" description="Direct shortcuts to manager workflows">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <QuickActionButton label="Create Order" tone="primary" onClick={() => navigate("/cashier")} />
              <QuickActionButton label="Open POS" onClick={() => navigate("/cashier")} />
              <QuickActionButton label="Kitchen" onClick={() => navigate("/kitchen")} />
              <QuickActionButton label="Assign Waiter" onClick={() => go("staff")} />
              <QuickActionButton label="Daily Report" onClick={() => go("reports")} />
              <QuickActionButton label="Sync Now" onClick={() => void syncNow()} />
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SectionCard title="Recent Activity" description="Latest order events and transaction movement">
              <div className="space-y-2">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-theme-text-secondary">No recent activity yet.</p>
                ) : (
                  recentActivity.map((event) => (
                    <article
                      key={event.id}
                      className="flex items-center justify-between rounded-xl border border-theme-border bg-theme-card px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {event.token ? `#${event.token}` : `#${event.id.slice(-6)}`} · {event.source}
                        </p>
                        <p className="text-xs text-theme-text-secondary">
                          {event.createdAt
                            ? event.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "Time unavailable"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusChip(event.status)}`}>
                          {event.status}
                        </span>
                        <p className="mt-1 text-xs font-semibold text-theme-text-primary">{formatMoney(event.amount)}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard title="Live Order Statistics" description="Realtime distribution of active orders by stage">
              <div className="space-y-3">
                {liveOrderStats.map((row) => (
                  <OrderStatRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    max={Math.max(...liveOrderStats.map((x) => x.value), 1)}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-theme-card p-3">
                  <p className="text-theme-text-secondary">Total Active</p>
                  <p className="mt-1 text-lg font-bold">{stats.activeOrders}</p>
                </div>
                <div className="rounded-xl bg-theme-card p-3">
                  <p className="text-theme-text-secondary">Average Ticket</p>
                  <p className="mt-1 text-lg font-bold">{formatMoney(stats.avgTicket)}</p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {!loading && activeKey === "orders" ? (
        <ManagerOrderManagement
          orders={orders}
          tables={tables}
          staff={staff}
          loading={loading}
          lastUpdated={lastUpdated}
        />
      ) : null}

      {!loading && activeKey === "tables" ? (
        <ManagerTableManagement
          tables={tables}
          orders={orders}
          staff={staff}
          loading={loading}
          lastUpdated={lastUpdated}
        />
      ) : null}

      {!loading && activeKey === "kitchen" ? (
        <ManagerKitchenMonitor orders={orders} loading={loading} lastUpdated={lastUpdated} />
      ) : null}

      {!loading && activeKey === "billing" ? (
        <ManagerBillingMonitor
          orders={orders}
          loading={loading}
          lastUpdated={lastUpdated}
        />
      ) : null}

      {!loading && activeKey === "customers" ? (
        <SectionCard title="Customers" description="Top customers by spend and repeat visits">
          <div className="space-y-2">
            {customers.map((customer) => (
              <article key={`${customer.name}-${customer.lastOrder?.toISOString() ?? "n/a"}`} className="grid grid-cols-1 gap-2 rounded-xl border border-theme-border bg-theme-card p-3 md:grid-cols-4">
                <p className="font-semibold">{customer.name}</p>
                <p className="text-sm text-theme-text-secondary">Orders: {customer.orders}</p>
                <p className="text-sm text-theme-text-secondary">Spend: {formatMoney(customer.spend)}</p>
                <p className="text-sm text-theme-text-secondary">Last: {formatDate(customer.lastOrder)}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {!loading && activeKey === "inventory" ? (
        <ManagerInventoryMonitor
          loading={loading}
          lastUpdated={lastUpdated}
        />
      ) : null}

      {!loading && activeKey === "staff" ? (
        <ManagerStaffManagement
          staff={staff}
          tables={tables}
          orders={orders}
          loading={loading}
          lastUpdated={lastUpdated}
        />
      ) : null}

      {!loading && activeKey === "reports" ? (
        <ManagerReportsModule
          orders={orders}
          products={products}
          staff={staff}
          loading={loading}
          lastUpdated={lastUpdated}
        />
      ) : null}

      {!loading && activeKey === "notifications" ? (
        <ManagerNotificationCenter
          orders={orders}
          loading={loading}
          lastUpdated={lastUpdated}
        />
      ) : null}

      {!loading && activeKey === "settings" ? (
        <ManagerSettings lastUpdated={lastUpdated} />
      ) : null}
    </ManagerModuleShell>
  );
}
