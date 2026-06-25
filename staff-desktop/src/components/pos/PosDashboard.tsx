import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { markCashierOrderPaid, type StaffOrderRow } from "@/services/orders";
import { initiatePosRazorpayPayment, verifyPosRazorpayPayment } from "@/services/pos-payment";
import {
  CASHIER_PAYMENT_METHODS,
  confirmCashierPosOrder,
  computePosBillTotals,
  type PaymentMethodId
} from "@/services/restaurant-orders";
import { useCashierOrders, useCashierOrdersSubscription } from "@/hooks/use-cashier-orders";
import { useCashierDashboardMetrics } from "@/hooks/use-cashier-dashboard-metrics";
import { useCashierKeyboardShortcuts } from "@/hooks/use-cashier-keyboard-shortcuts";
import { useCashierMenu } from "@/hooks/use-cashier-menu";
import { usePosSettings } from "@/hooks/use-pos-settings";
import { usePrinters } from "@/hooks/use-printers";
import { useTables } from "@/hooks/use-tables";
import { isOrderPaid } from "@/lib/cashier-order-filters";
import { printCashierOrderDocuments } from "@/lib/pos/cashier-print";
import { getRazorpayPublicKeyId, openRazorpayCheckout } from "@/lib/pos/razorpay-checkout";
import { validateCouponCode } from "@/lib/pos/coupon-validate";
import { useCashierPosStore } from "@/lib/pos/cashier-pos-store";
import { saveHeldOrder, loadHeldOrders, removeHeldOrder, type HeldOrder } from "@/lib/pos/hold-orders-store";
import { formatItemExtras } from "@/lib/pos/format-item-extras";
import { resolveOrderSource } from "@/lib/pos/order-source";
import {
  countWorkflowStatuses,
  isChannelPlatform,
  orderBelongsToPlatform
} from "@/lib/pos/order-workflow-status";
import type { CartLine, PosNotification, SplitPaymentLine } from "@/components/pos/pos-types";
import { channelToBackendOrder } from "@/components/pos/pos-types";
import { Modal, Toast } from "@/components/modals/Modal";
import { OrderChannelManager } from "@/components/pos/OrderChannelManager";
import { formatLineExtras, ItemModificationsModal } from "@/components/pos/ItemModificationsModal";
import { useChannelOrderAlerts } from "@/hooks/use-channel-order-alerts";
import { menuProductEmoji } from "@shared/lib/firebase-menu";

function formatPrice(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

type PosDashboardProps = {
  onNotificationCountChange?: (count: number) => void;
};

export type PosDashboardHandle = {
  openNotifications: () => void;
  openShortcuts: () => void;
  openHistory: () => void;
};

export const PosDashboard = forwardRef<PosDashboardHandle, PosDashboardProps>(function PosDashboard(
  { onNotificationCountChange },
  ref
) {
  useCashierOrdersSubscription(true);
  const ordersHub = useCashierOrders();
  const { allOrders, visibleOrders, platformCounts, loading: ordersLoading } = ordersHub;

  const { products, categories, loading: menuLoading, error: menuError } = useCashierMenu(true);
  const { tables } = useTables(true);
  const { settings: posSettings, taxPercent } = usePosSettings();
  const { printers } = usePrinters();

  const platformFilter = useCashierPosStore((s) => s.platformFilter);
  const setPlatformFilter = useCashierPosStore((s) => s.setPlatformFilter);
  const orderSearch = useCashierPosStore((s) => s.orderSearch);
  const setOrderSearch = useCashierPosStore((s) => s.setOrderSearch);
  const selectedOrderId = useCashierPosStore((s) => s.selectedOrderId);
  const selectOrder = useCashierPosStore((s) => s.selectOrder);
  const openOrderModal = useCashierPosStore((s) => s.openOrderModal);
  const closeOrderModal = useCashierPosStore((s) => s.closeOrderModal);
  const showOrderModal = useCashierPosStore((s) => s.showOrderModal);

  const activeTableCount = useMemo(() => tables.filter((t) => t.status === "occupied").length, [tables]);
  const metrics = useCashierDashboardMetrics(allOrders, activeTableCount);

  const [panelMode, setPanelMode] = useState<"new" | "existing">("new");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [menuSearch, setMenuSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cash");
  const [discountFlatAmount, setDiscountFlatAmount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "info" | "success" | "error" } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => loadHeldOrders());
  const [modifyTarget, setModifyTarget] = useState<
    | { kind: "new"; id: string; name: string; price: number }
    | { kind: "edit"; line: CartLine }
    | null
  >(null);

  const useRazorpay =
    posSettings.paymentProvider === "razorpay" && (paymentMethod === "upi" || paymentMethod === "card");

  const menuSearchRef = useRef<HTMLInputElement>(null);

  const selectedOrder = useMemo(
    () => allOrders.find((o) => o.id === selectedOrderId) ?? null,
    [allOrders, selectedOrderId]
  );

  const filteredProducts = useMemo(() => {
    let rows = products;
    if (selectedCategory !== "all") {
      rows = rows.filter((p) => (p.category ?? "Other") === selectedCategory);
    }
    const q = menuSearch.trim().toLowerCase();
    if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
    return rows;
  }, [products, selectedCategory, menuSearch]);

  const cartSubtotal = useMemo(
    () => Math.round(cart.reduce((s, l) => s + l.unitPrice * l.qty, 0) * 100) / 100,
    [cart]
  );

  const billTotals = useMemo(
    () =>
      computePosBillTotals(
        panelMode === "new" ? cartSubtotal : (selectedOrder?.totalAmount ?? 0),
        taxPercent,
        0,
        0,
        discountFlatAmount
      ),
    [panelMode, cartSubtotal, selectedOrder, taxPercent, discountFlatAmount]
  );

  const notifications = useMemo((): PosNotification[] => {
    const list: PosNotification[] = [];
    for (const o of allOrders) {
      if (!isOrderPaid(o.paymentStatus) && (o.canonicalStatus === "ready" || o.canonicalStatus === "served")) {
        list.push({ id: `pay-${o.id}`, title: "Payment pending", body: `Order ${o.id.slice(0, 8)}`, time: new Date(), kind: "payment" });
      }
      const src = resolveOrderSource(o);
      if (src === "swiggy") list.push({ id: `sw-${o.id}`, title: "Swiggy order", body: o.id.slice(0, 8), time: new Date(), kind: "swiggy" });
      if (src === "zomato") list.push({ id: `zo-${o.id}`, title: "Zomato order", body: o.id.slice(0, 8), time: new Date(), kind: "zomato" });
    }
    return list.slice(0, 20);
  }, [allOrders]);

  useEffect(() => {
    onNotificationCountChange?.(notifications.length);
  }, [notifications.length, onNotificationCountChange]);

  useImperativeHandle(ref, () => ({
    openNotifications: () => setShowNotifications(true),
    openShortcuts: () => setShowShortcuts(true),
    openHistory: () => setShowHistory(true)
  }));

  const showToast = useCallback((msg: string, type: "info" | "success" | "error" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useChannelOrderAlerts(allOrders, showToast, true);

  const channelPlatformCounts = useMemo(() => {
    const counts: Record<typeof platformFilter, number> = {
      parcel: platformCounts.parcel,
      swiggy: 0,
      zomato: 0,
      online: 0,
      waiter: 0
    };
    for (const platform of ["swiggy", "zomato", "online", "waiter"] as const) {
      const slice = allOrders.filter((o) => orderBelongsToPlatform(o, platform));
      const wc = countWorkflowStatuses(slice);
      counts[platform] = wc.new + wc.accepted + wc.preparing + wc.ready;
    }
    return counts;
  }, [allOrders, platformCounts.parcel]);

  const resetNewOrder = useCallback(() => {
    setCart([]);
    setCustomerName("");
    setPhone("");
    setDiscountFlatAmount(0);
    setCouponCode("");
    setCouponError(null);
    setCashReceived("");
    setSplitLines([]);
    setPanelMode("new");
    selectOrder(null);
  }, [selectOrder]);

  const buildCartLinesForOrder = useCallback(
    () =>
      cart.map((l) => ({
        productId: l.menuItemId,
        name: l.name,
        unitPrice: l.unitPrice,
        qty: l.qty,
        ...(l.note ? { note: l.note } : {}),
        ...(l.modifications?.length ? { modifications: l.modifications } : {})
      })),
    [cart]
  );

  const openProductModal = useCallback(
    (product: { id: string; name: string; price: number }) => {
      const existing = cart.find((l) => l.menuItemId === product.id);
      if (existing) {
        setModifyTarget({ kind: "edit", line: existing });
      } else {
        setModifyTarget({ kind: "new", id: product.id, name: product.name, price: product.price });
      }
    },
    [cart]
  );

  const saveItemModifications = useCallback(
    (mods: string[], note: string) => {
      if (!modifyTarget) return;
      const modList = mods.length > 0 ? mods : undefined;
      const noteText = note || undefined;
      if (modifyTarget.kind === "new") {
        setCart((prev) => [
          ...prev,
          {
            menuItemId: modifyTarget.id,
            name: modifyTarget.name,
            unitPrice: modifyTarget.price,
            qty: 1,
            modifications: modList,
            note: noteText
          }
        ]);
      } else {
        setModifyTarget(null);
        setCart((prev) =>
          prev.map((l) =>
            l.menuItemId === modifyTarget.line.menuItemId
              ? { ...l, modifications: modList, note: noteText }
              : l
          )
        );
        return;
      }
      setModifyTarget(null);
    },
    [modifyTarget]
  );

  const updateCartQty = useCallback((menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.menuItemId === menuItemId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  }, []);

  const handleHold = useCallback(() => {
    if (cart.length === 0) return;
    saveHeldOrder({
      label: customerName || "Held order",
      cart,
      customerName,
      phone,
      orderType: "parcel"
    });
    setHeldOrders(loadHeldOrders());
    resetNewOrder();
    showToast("Order held", "success");
  }, [cart, customerName, phone, resetNewOrder, showToast]);

  const handleResumeHeld = useCallback(
    (held: HeldOrder) => {
      setCart(held.cart);
      setCustomerName(held.customerName ?? "");
      setPhone(held.phone ?? "");
      removeHeldOrder(held.id);
      setHeldOrders(loadHeldOrders());
      setPanelMode("new");
      showToast("Held order resumed", "success");
    },
    [showToast]
  );

  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    const result = await validateCouponCode(couponCode.trim(), cartSubtotal);
    if (!result.ok) {
      setCouponError(result.error ?? "Invalid coupon");
      return;
    }
    setCouponError(null);
    setDiscountFlatAmount(result.discount ?? 0);
    showToast(`Coupon applied: -${formatPrice(result.discount ?? 0)}`, "success");
  }, [couponCode, cartSubtotal, showToast]);

  const handlePayAndComplete = useCallback(async () => {
    if (cart.length === 0) {
      showToast("Add items to cart first", "error");
      return;
    }
    if (!paymentMethod) {
      showToast("Select a payment method", "error");
      return;
    }
    if (paymentMethod === "cash") {
      const received = Number(cashReceived) || 0;
      if (received < billTotals.grandTotal) {
        showToast("Cash received must cover the total", "error");
        return;
      }
    }
    setBusy(true);
    try {
      const backend = channelToBackendOrder("parcel");
      const method: PaymentMethodId = paymentMethod === "split" ? "cash" : paymentMethod;
      const placed = await confirmCashierPosOrder({
        orderType: backend.orderType,
        lines: buildCartLinesForOrder(),
        source: backend.source,
        customerName: customerName || undefined,
        phone: phone || undefined,
        couponCode: couponCode || undefined,
        discountAmount: discountFlatAmount > 0 ? discountFlatAmount : undefined,
        paymentMethod: method,
        markPaid: !useRazorpay,
        totalAmount: billTotals.grandTotal,
        taxAmount: billTotals.taxAmount,
        taxPercent: billTotals.taxPercent
      });

      if (useRazorpay) {
        const amountPaise = Math.round(billTotals.grandTotal * 100);
        const { razorpayOrderId, keyId: serverKeyId } = await initiatePosRazorpayPayment(
          placed.orderId,
          paymentMethod === "card" ? "online" : "upi",
          amountPaise
        );
        const keyId = serverKeyId || getRazorpayPublicKeyId();
        if (!keyId) throw new Error("Razorpay key is not configured (VITE_RAZORPAY_KEY_ID).");

        const paid = await new Promise<boolean>((resolve) => {
          void openRazorpayCheckout({
            keyId,
            amountPaise,
            currency: "INR",
            orderId: razorpayOrderId,
            customerName: customerName || "Walk-in",
            customerPhone: phone,
            description: `Parcel order #${placed.tokenNumber}`,
            onSuccess: async (response) => {
              try {
                await verifyPosRazorpayPayment({
                  orderId: placed.orderId,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature
                });
                await markCashierOrderPaid(placed.orderId, method, {
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id
                });
                resolve(true);
              } catch {
                resolve(false);
              }
            },
            onDismiss: () => resolve(false)
          });
        });

        if (!paid) {
          showToast("Payment cancelled or failed — order saved as unpaid", "error");
          return;
        }
      }

      const orderRow: StaffOrderRow = {
        id: placed.orderId,
        items: placed.items.map((it, i) => ({
          id: it.productId || `line_${i}`,
          name: it.name,
          price: it.unitPrice,
          qty: it.qty,
          ...(it.note ? { note: it.note } : {}),
          ...(it.modifications?.length ? { modifications: it.modifications } : {})
        })),
        totalAmount: billTotals.grandTotal,
        status: "accepted",
        canonicalStatus: "accepted",
        tokenNumber: placed.tokenNumber,
        paymentStatus: "paid",
        orderType: "parcel",
        createdAt: null,
        updatedAt: null,
        assignedTo: {},
        customer: { name: customerName || "Guest", phone: phone || "", address: "" }
      };

      const printResult = await printCashierOrderDocuments({
        order: orderRow,
        paymentMethod: method,
        taxPercent,
        printers,
        posSettings
      });

      if (printResult.receiptPrinted || printResult.kotPrinted) {
        showToast(`Paid · Order #${placed.tokenNumber} sent to kitchen · Printed`, "success");
      } else {
        showToast(`Paid · Order #${placed.tokenNumber} sent to kitchen`, "success");
      }
      resetNewOrder();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Payment failed", "error");
    } finally {
      setBusy(false);
    }
  }, [
    cart.length,
    paymentMethod,
    cashReceived,
    billTotals,
    useRazorpay,
    phone,
    buildCartLinesForOrder,
    customerName,
    couponCode,
    discountFlatAmount,
    taxPercent,
    printers,
    posSettings,
    showToast,
    resetNewOrder
  ]);

  const handleAcceptPayment = useCallback(async () => {
    const order = selectedOrder;
    if (!order) {
      if (panelMode === "new" && cart.length > 0) {
        await handlePayAndComplete();
      }
      return;
    }
    if (isOrderPaid(order.paymentStatus)) {
      showToast("Order already paid", "info");
      return;
    }
    setBusy(true);
    try {
      await markCashierOrderPaid(order.id, paymentMethod === "qr" ? "cash" : paymentMethod);
      const printResult = await printCashierOrderDocuments({
        order,
        paymentMethod,
        taxPercent,
        printers,
        posSettings
      });
      if (printResult.receiptPrinted || printResult.kotPrinted) {
        showToast("Payment recorded · Sent to kitchen · Printed", "success");
      } else {
        showToast("Payment recorded · Sent to kitchen", "success");
      }
      closeOrderModal();
      selectOrder(null);
      setPanelMode("new");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Payment failed", "error");
    } finally {
      setBusy(false);
    }
  }, [
    selectedOrder, panelMode, cart.length, handlePayAndComplete, paymentMethod,
    taxPercent, printers, posSettings, showToast, closeOrderModal, selectOrder
  ]);

  useCashierKeyboardShortcuts(
    {
      onFocusMenuSearch: () => menuSearchRef.current?.focus(),
      onNewOrder: resetNewOrder,
      onAcceptPayment: () => void handleAcceptPayment(),
      onPrint: () => selectedOrder && void printCashierOrderDocuments({ order: selectedOrder, paymentMethod, taxPercent, printers, posSettings }),
      onHold: handleHold,
      onCustomer: () => menuSearchRef.current?.blur(),
      onKitchen: () => setShowHistory(true),
      onClearSelection: () => {
        closeOrderModal();
        resetNewOrder();
      },
      onToggleHistory: () => setShowHistory((v) => !v),
      onShowShortcuts: () => setShowShortcuts(true),
      onSelectPaymentMethod: (idx) => {
        const methods = (CASHIER_PAYMENT_METHODS as readonly string[]).filter((m) =>
          posSettings.enabledPaymentMethods?.includes(m as (typeof posSettings.enabledPaymentMethods)[number])
        );
        const picked = methods[idx];
        if (picked && picked !== "qr") setPaymentMethod(picked as PaymentMethodId);
      }
    },
    true
  );

  const platformTabs = [
    { id: "parcel" as const, label: "Parcel", count: channelPlatformCounts.parcel },
    { id: "swiggy" as const, label: "Swiggy", count: channelPlatformCounts.swiggy },
    { id: "zomato" as const, label: "Zomato", count: channelPlatformCounts.zomato },
    { id: "online" as const, label: "Online", count: channelPlatformCounts.online },
    { id: "waiter" as const, label: "Waiter", count: channelPlatformCounts.waiter }
  ];

  const showChannelManager = isChannelPlatform(platformFilter);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Metrics + platform tabs */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>Sales {formatPrice(metrics.todaySales)}</span>
          <span>Orders {metrics.todayOrders}</span>
          <span>Pending {metrics.pendingCount}</span>
          <span>Tables {activeTableCount}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {platformTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPlatformFilter(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                platformFilter === tab.id ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
          <input
            type="search"
            placeholder="Search orders…"
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="ml-auto h-10 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>

      {showChannelManager ? (
        <div className="pos-channel-workspace min-h-0 flex-1">
          <OrderChannelManager
            platform={platformFilter}
            orders={allOrders}
            loading={ordersLoading}
            onToast={showToast}
          />
        </div>
      ) : (
      <div className="pos-workspace-grid min-h-0 flex-1">
        {/* Categories */}
        <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <h2 className="shrink-0 border-b px-4 py-3 text-sm font-bold dark:border-slate-800">Categories</h2>
          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${selectedCategory === "all" ? "bg-brand-teal text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${selectedCategory === cat ? "bg-brand-teal text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              >
                {cat}
              </button>
            ))}
          </nav>
        </aside>

        {/* Products */}
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden p-3 lg:p-4">
          <input
            ref={menuSearchRef}
            type="search"
            placeholder="Search products… (F1)"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            className="mb-4 h-11 rounded-xl border border-slate-200 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          {menuError ? <p className="mb-2 text-sm text-red-600">{menuError}</p> : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="pos-product-grid">
              {(menuLoading && filteredProducts.length === 0 ? [] : filteredProducts).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  disabled={product.available === false}
                  onClick={() => openProductModal({ id: product.id, name: product.name, price: product.price })}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-teal/40 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-2 flex h-16 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 text-4xl dark:from-teal-900/30">
                    {menuProductEmoji(product.name, product.category ?? "")}
                  </div>
                  <p className="text-sm font-bold">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.category}</p>
                  <p className="mt-2 text-lg font-extrabold text-brand-teal">{formatPrice(product.price)}</p>
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* Bill panel */}
        <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex border-b dark:border-slate-800">
            <button type="button" onClick={() => setPanelMode("new")} className={`flex-1 py-3 text-sm font-bold ${panelMode === "new" ? "border-b-2 border-brand-teal text-brand-teal" : ""}`}>
              New Order
            </button>
            <button type="button" onClick={() => setPanelMode("existing")} className={`flex-1 py-3 text-sm font-bold ${panelMode === "existing" ? "border-b-2 border-brand-teal text-brand-teal" : ""}`}>
              Existing ({visibleOrders.length})
            </button>
          </div>

          {panelMode === "new" ? (
            <>
              <div className="space-y-2 border-b p-3 dark:border-slate-800">
                <input placeholder="Customer name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {cart.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">Cart empty</p>
                ) : (
                  cart.map((line) => {
                    const extras = formatLineExtras(line);
                    return (
                    <div key={line.menuItemId} className="mb-2 rounded-xl border p-2 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setModifyTarget({ kind: "edit", line })}
                        className="mb-1 w-full text-left"
                      >
                        <p className="truncate text-sm font-semibold">{line.name}</p>
                        <p className="text-xs text-slate-500">{formatPrice(line.unitPrice)}</p>
                        {extras ? <p className="mt-0.5 text-[11px] text-brand-teal">{extras}</p> : null}
                        <p className="mt-0.5 text-[10px] text-slate-400">Tap to customize</p>
                      </button>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => updateCartQty(line.menuItemId, -1)} className="h-9 w-9 rounded-lg border">−</button>
                        <span className="w-6 text-center text-sm font-bold">{line.qty}</span>
                        <button type="button" onClick={() => updateCartQty(line.menuItemId, 1)} className="h-9 w-9 rounded-lg border border-brand-teal/30 bg-brand-teal/10">+</button>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {ordersLoading ? <p className="p-4 text-sm text-slate-400">Loading orders…</p> : null}
              {visibleOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    selectOrder(order.id);
                    openOrderModal(order.id);
                    setPanelMode("existing");
                  }}
                  className={`mb-2 w-full rounded-xl border p-3 text-left dark:border-slate-700 ${selectedOrderId === order.id ? "border-brand-teal bg-brand-teal/5" : ""}`}
                >
                  <div className="flex justify-between text-sm font-bold">
                    <span>#{order.tokenNumber ?? order.id.slice(-6)}</span>
                    <span>{formatPrice(order.totalAmount)}</span>
                  </div>
                  <p className="text-xs text-slate-500">{order.canonicalStatus} · {resolveOrderSource(order)}</p>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-theme-border bg-theme-surface p-4">
            <div className="mb-2 flex gap-1">
              <input placeholder="Coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="theme-input flex-1 rounded-lg px-2 py-1.5 text-xs" />
              <button type="button" onClick={() => void handleApplyCoupon()} className="rounded-lg bg-theme-hover px-2 py-1.5 text-xs font-bold text-theme-text-primary">Apply</button>
            </div>
            {couponError ? <p className="mb-1 text-xs text-theme-danger">{couponError}</p> : null}
            <div className="mb-3 space-y-1 text-sm text-theme-text-primary">
              <div className="flex justify-between"><span className="text-theme-text-secondary">Subtotal</span><span>{formatPrice(billTotals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-theme-text-secondary">Tax ({billTotals.taxPercent}%)</span><span>{formatPrice(billTotals.taxAmount)}</span></div>
              <div className="flex justify-between text-base font-extrabold text-theme-primary"><span>Total</span><span>{formatPrice(billTotals.grandTotal)}</span></div>
            </div>
            <div className="mb-3 flex flex-wrap gap-1">
              {CASHIER_PAYMENT_METHODS.filter(
                (m) => m !== "qr" && posSettings.enabledPaymentMethods?.includes(m as (typeof posSettings.enabledPaymentMethods)[number])
              ).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                    paymentMethod === m
                      ? "bg-theme-primary text-white shadow-glow-sm"
                      : "bg-theme-hover text-theme-text-secondary hover:text-theme-text-primary"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {paymentMethod === "cash" ? (
              <input placeholder="Cash received" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="theme-input mb-2 w-full rounded-lg px-3 py-2 text-sm" />
            ) : null}
            {paymentMethod === "upi" && !useRazorpay && posSettings.upiVpa ? (
              <div className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
                <p className="font-bold text-slate-500">Pay to UPI</p>
                <p className="font-mono text-sm">{posSettings.upiVpa}</p>
              </div>
            ) : null}
            {useRazorpay ? (
              <p className="mb-2 text-xs text-slate-500">
                Razorpay checkout opens for {paymentMethod === "card" ? "card" : "UPI"}.
              </p>
            ) : null}
            {paymentMethod === "split" ? (
              <div className="mb-2 space-y-1">
                {splitLines.map((sl, i) => (
                  <div key={i} className="flex gap-1 text-xs">
                    <span>{sl.method}</span>
                    <span>{formatPrice(sl.amount)}</span>
                  </div>
                ))}
                <button type="button" onClick={() => setSplitLines([...splitLines, { method: "cash", amount: billTotals.grandTotal / 2 }])} className="text-xs text-brand-teal">+ Add split line</button>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy || cart.length === 0}
                onClick={() => void (panelMode === "new" ? handlePayAndComplete() : handleAcceptPayment())}
                className="col-span-2 min-h-[52px] rounded-xl bg-theme-primary px-4 py-3 text-sm font-bold text-white shadow-glow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? "Processing…"
                  : panelMode === "new"
                    ? paymentMethod === "cash"
                      ? "Confirm cash & print (F3)"
                      : useRazorpay
                        ? "Pay with Razorpay"
                        : "Payment received — print (F3)"
                    : "Accept Payment (F3)"}
              </button>
              <button
                type="button"
                onClick={handleHold}
                className="min-h-[44px] rounded-xl border border-theme-border bg-theme-hover font-bold text-theme-text-primary transition hover:border-theme-primary/40"
              >
                Hold (F5)
              </button>
              <button
                type="button"
                onClick={resetNewOrder}
                className="min-h-[44px] rounded-xl border border-theme-border bg-theme-hover font-bold text-theme-text-primary transition hover:border-theme-primary/40"
              >
                New (F2)
              </button>
            </div>
            {heldOrders.length > 0 ? (
              <div className="mt-3 border-t pt-2 dark:border-slate-800">
                <p className="mb-1 text-xs font-bold text-slate-500">Held orders</p>
                {heldOrders.map((h) => (
                  <button key={h.id} type="button" onClick={() => handleResumeHeld(h)} className="mb-1 w-full rounded-lg bg-amber-50 px-2 py-1.5 text-left text-xs dark:bg-amber-900/20">
                    {h.cart.length} items · {h.customerName || "Walk-in"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
      )}

      <Modal open={showOrderModal && !!selectedOrder} onClose={closeOrderModal} title="Order detail" widthClass="max-w-xl">
        {selectedOrder ? (
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">Token</span><p className="font-bold">#{selectedOrder.tokenNumber ?? "—"}</p></div>
              <div><span className="text-slate-500">Status</span><p className="font-bold capitalize">{selectedOrder.canonicalStatus}</p></div>
              <div><span className="text-slate-500">Source</span><p className="font-bold">{resolveOrderSource(selectedOrder)}</p></div>
              <div><span className="text-slate-500">Total</span><p className="font-bold">{formatPrice(selectedOrder.totalAmount)}</p></div>
            </div>
            <ul className="divide-y rounded-xl border dark:border-slate-700">
              {selectedOrder.items.map((it, i) => {
                const extras = formatItemExtras(it);
                return (
                <li key={i} className="px-4 py-2 text-sm">
                  <div className="flex justify-between">
                    <span>{it.qty}× {it.name}</span>
                    <span>{formatPrice(it.price * it.qty)}</span>
                  </div>
                  {extras ? <p className="mt-0.5 text-xs text-brand-teal">{extras}</p> : null}
                </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <button type="button" disabled={busy || isOrderPaid(selectedOrder.paymentStatus)} onClick={() => void handleAcceptPayment()} className="flex-1 rounded-xl bg-brand-teal py-3 font-bold text-white disabled:opacity-50">
                Accept payment
              </button>
              <button type="button" onClick={() => void printCashierOrderDocuments({ order: selectedOrder, paymentMethod, taxPercent, printers, posSettings })} className="rounded-xl border px-4 py-3 font-bold">
                Print (F4)
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={showNotifications} onClose={() => setShowNotifications(false)} title="Notifications">
        <ul className="divide-y dark:divide-slate-800">
          {notifications.length === 0 ? <li className="p-6 text-sm text-slate-400">No notifications</li> : null}
          {notifications.map((n) => (
            <li key={n.id} className="px-6 py-3">
              <p className="text-sm font-bold">{n.title}</p>
              <p className="text-xs text-slate-500">{n.body}</p>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Keyboard shortcuts">
        <ul className="space-y-2 p-6 text-sm">
          <li><kbd className="rounded bg-slate-100 px-2 py-1 font-mono">F1</kbd> Search products</li>
          <li><kbd className="rounded bg-slate-100 px-2 py-1 font-mono">F2</kbd> New order</li>
          <li><kbd className="rounded bg-slate-100 px-2 py-1 font-mono">F3</kbd> Accept payment</li>
          <li><kbd className="rounded bg-slate-100 px-2 py-1 font-mono">F4</kbd> Print</li>
          <li><kbd className="rounded bg-slate-100 px-2 py-1 font-mono">F5</kbd> Hold order</li>
          <li><kbd className="rounded bg-slate-100 px-2 py-1 font-mono">F6</kbd> Discount 10%</li>
          <li><kbd className="rounded bg-slate-100 px-2 py-1 font-mono">F7</kbd> Customer focus</li>
          <li><kbd className="rounded bg-slate-100 px-2 py-1 font-mono">F8</kbd> Order history</li>
          <li><kbd className="rounded bg-slate-100 px-2 py-1 font-mono">ESC</kbd> Cancel / close</li>
        </ul>
      </Modal>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Recent orders" widthClass="max-w-3xl">
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">Token</th><th>Source</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {allOrders.slice(0, 50).map((o) => (
                <tr key={o.id} className="border-b dark:border-slate-800">
                  <td className="py-2 font-mono">#{o.tokenNumber ?? o.id.slice(-6)}</td>
                  <td>{resolveOrderSource(o)}</td>
                  <td className="capitalize">{o.canonicalStatus}</td>
                  <td>{formatPrice(o.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <ItemModificationsModal
        open={modifyTarget != null}
        productName={
          modifyTarget?.kind === "new" ? modifyTarget.name : (modifyTarget?.line.name ?? "")
        }
        initialModifications={
          modifyTarget?.kind === "edit" ? (modifyTarget.line.modifications ?? []) : []
        }
        initialNote={modifyTarget?.kind === "edit" ? (modifyTarget.line.note ?? "") : ""}
        onClose={() => setModifyTarget(null)}
        onSave={saveItemModifications}
      />

      {toast ? <Toast message={toast.msg} type={toast.type} /> : null}
    </div>
  );
});
