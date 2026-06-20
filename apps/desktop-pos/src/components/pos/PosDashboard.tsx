import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import type { StaffOrderRow } from "@/services/orders";
import { markCashierOrderPaid } from "@/services/orders";
import {
  CASHIER_PAYMENT_METHODS,
  confirmCashierPosOrder,
  type PaymentMethodId
} from "@/services/restaurant-orders";
import { getStaffAuth } from "@/lib/firebase";
import { useCashierOrders, useCashierOrdersSubscription } from "@/hooks/use-cashier-orders";
import { useCashierDashboardMetrics } from "@/hooks/use-cashier-dashboard-metrics";
import { useCashierKeyboardShortcuts } from "@/hooks/use-cashier-keyboard-shortcuts";
import { usePosMenu } from "@/hooks/use-pos-menu";
import { usePosSettings } from "@/hooks/use-pos-settings";
import { usePrinters } from "@/hooks/use-printers";
import { useTables, type FloorTable } from "@/hooks/use-tables";
import { isOrderPaid } from "@/lib/cashier-order-filters";
import { printCashierOrderDocuments } from "@/lib/pos/cashier-print";
import { validateCouponCode } from "@/lib/pos/coupon-validate";
import { BillPaymentPanel, type BillMode } from "@/components/pos/BillPaymentPanel";
import { CategorySidebar } from "@/components/pos/CategorySidebar";
import { MenuPanel } from "@/components/pos/MenuPanel";
import { PosBottomBar } from "@/components/pos/PosBottomBar";
import { PosNavbar } from "@/components/pos/PosNavbar";
import { PosOrderSourceBar } from "@/components/pos/PosOrderSourceBar";
import { PosPlatformOrdersPanel } from "@/components/pos/PosPlatformOrdersPanel";
import { PosPlatformStatusFilter } from "@/components/pos/PosPlatformStatusFilter";
import { PosOrderDetailModal } from "@/components/pos/PosOrderDetailModal";
import { PosRecentParcelDrawer, RecentParcelOrdersButton } from "@/components/pos/PosRecentParcelDrawer";
import { PosTestingFab, PosTestingPanelModal } from "@/components/pos/PosTestingPanel";
import { useCashierPosStore } from "@/lib/pos/cashier-pos-store";
import { filterParcelModuleOrders } from "@/lib/pos/cashier-orders-view";
import { removeHeldOrder, saveHeldOrder, type HeldOrder } from "@/lib/pos/hold-orders-store";
import type { CartLine, DiscountMode, PosNotification, PosOrderChannel, SplitPaymentLine } from "@/components/pos/pos-types";
import { channelToBackendOrder } from "@/components/pos/pos-types";
import { bootstrapPosFcm } from "@/lib/fcm";
import { bootstrapPosAuth } from "@/lib/firebase";
import { resolveOrderSource } from "@/lib/pos/order-source";
import { platformToSource } from "@/lib/pos-theme";

type SyncStatus = {
  online: boolean;
  unsyncedCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  syncing: boolean;
};

function toast(msg: string) {
  console.info("[POS]", msg);
}

export function PosDashboard() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    online: false,
    unsyncedCount: 0,
    lastSyncAt: null,
    lastError: null,
    syncing: false
  });
  const [cashierName, setCashierName] = useState("cashier");
  useCashierOrdersSubscription(true);
  const ordersHub = useCashierOrders();
  const {
    allOrders,
    visibleOrders,
    parcelOrders,
    todayParcelCount,
    platformCounts,
    platformStatusCounts,
    loading: ordersLoading
  } = ordersHub;

  const { products, grouped, categories, loading: menuLoading, error: menuError } = usePosMenu(syncStatus.online);
  const { tables, loading: tablesLoading } = useTables(true);
  const { settings: posSettings, taxPercent } = usePosSettings();
  const { printers } = usePrinters();

  const platformFilter = useCashierPosStore((s) => s.platformFilter);
  const statusFilters = useCashierPosStore((s) => s.statusFilters);
  const orderSearch = useCashierPosStore((s) => s.orderSearch);
  const showOrderModal = useCashierPosStore((s) => s.showOrderModal);
  const setPlatformFilter = useCashierPosStore((s) => s.setPlatformFilter);
  const setPlatformStatusFilter = useCashierPosStore((s) => s.setPlatformStatusFilter);
  const setOrderSearch = useCashierPosStore((s) => s.setOrderSearch);
  const openOrderModal = useCashierPosStore((s) => s.openOrderModal);
  const closeOrderModal = useCashierPosStore((s) => s.closeOrderModal);
  const selectOrder = useCashierPosStore((s) => s.selectOrder);
  const showRecentParcelDrawer = useCashierPosStore((s) => s.showRecentParcelDrawer);
  const setShowRecentParcelDrawer = useCashierPosStore((s) => s.setShowRecentParcelDrawer);
  const cancelTestOrder = useCashierPosStore((s) => s.cancelTestOrder);

  const isParcelMode = platformFilter === "parcel";
  const activeStatusCounts = platformStatusCounts[platformFilter];

  const filteredParcelOrders = useMemo(
    () => filterParcelModuleOrders(parcelOrders, statusFilters.parcel, ""),
    [parcelOrders, statusFilters.parcel]
  );

  const activeTableCount = useMemo(() => tables.filter((t) => t.status === "occupied").length, [tables]);
  const metrics = useCashierDashboardMetrics(allOrders, activeTableCount);

  const [billMode, setBillMode] = useState<BillMode>("new");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [discountFlatAmount, setDiscountFlatAmount] = useState(0);
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderChannel, setOrderChannel] = useState<PosOrderChannel>("parcel");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress] = useState("");
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [serviceChargePercent, setServiceChargePercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const menuSearchRef = useRef<HTMLInputElement>(null);

  const selectedOrder = useMemo(
    () => allOrders.find((o) => o.id === selectedOrderId) ?? null,
    [allOrders, selectedOrderId]
  );

  useEffect(() => {
    void bootstrapPosAuth((user) => {
      setCashierName(user?.displayName ?? user?.email?.split("@")[0] ?? "cashier");
    });
    void bootstrapPosFcm();
    if (window.posApi) {
      void window.posApi.getSyncStatus().then(setSyncStatus);
    }
  }, []);

  useEffect(() => {
    if (!window.posApi?.onSyncStatus) return undefined;
    return window.posApi.onSyncStatus(setSyncStatus);
  }, []);

  const notifications = useMemo((): PosNotification[] => {
    const list: PosNotification[] = [];
    for (const o of allOrders) {
      if (!isOrderPaid(o.paymentStatus) && (o.canonicalStatus === "ready" || o.canonicalStatus === "served")) {
        list.push({ id: `pay-${o.id}`, title: "Payment pending", body: `Order ready for checkout`, time: new Date(), kind: "payment" });
      }
      const src = resolveOrderSource(o);
      if (src === "swiggy") list.push({ id: `sw-${o.id}`, title: "Swiggy order", body: o.id.slice(0, 8), time: new Date(), kind: "swiggy" });
      if (src === "zomato") list.push({ id: `zo-${o.id}`, title: "Zomato order", body: o.id.slice(0, 8), time: new Date(), kind: "zomato" });
    }
    return list.slice(0, 20);
  }, [allOrders]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) counts[p.category ?? "Other"] = (counts[p.category ?? "Other"] ?? 0) + 1;
    return counts;
  }, [products]);

  const visibleProducts = useMemo(() => {
    let rows = products;
    if (selectedCategory !== "all") rows = rows.filter((p) => (p.category ?? "Other") === selectedCategory);
    const q = menuSearch.trim().toLowerCase();
    if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category ?? "Other",
      image: p.image ?? null
    }));
  }, [products, selectedCategory, menuSearch]);

  const cartQtyById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const line of cart) m[line.menuItemId] = line.qty;
    return m;
  }, [cart]);

  const addToCart = useCallback(
    (item: { id: string; name: string; price: number }) => {
      if (!isParcelMode) return;
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.menuItemId === item.id);
        if (idx < 0) return [...prev, { menuItemId: item.id, name: item.name, unitPrice: item.price, qty: 1 }];
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      });
      if (billMode === "existing") {
        setBillMode("new");
        setSelectedOrderId(null);
      }
    },
    [billMode, isParcelMode]
  );

  const decFromCart = useCallback((item: { id: string }) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.menuItemId === item.id);
      if (idx < 0) return prev;
      const nextQty = prev[idx].qty - 1;
      if (nextQty <= 0) return prev.filter((l) => l.menuItemId !== item.id);
      const next = [...prev];
      next[idx] = { ...next[idx], qty: nextQty };
      return next;
    });
  }, []);

  const onCartQtyChange = useCallback((menuItemId: string, delta: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.menuItemId === menuItemId);
      if (idx < 0) return prev;
      const nextQty = prev[idx].qty + delta;
      if (nextQty <= 0) return prev.filter((l) => l.menuItemId !== menuItemId);
      const next = [...prev];
      next[idx] = { ...next[idx], qty: nextQty };
      return next;
    });
  }, []);

  const onRemoveCartLine = useCallback((menuItemId: string) => {
    setCart((prev) => prev.filter((l) => l.menuItemId !== menuItemId));
  }, []);

  const onCartLineModify = useCallback(
    (menuItemId: string, updates: { modifications?: string[]; note?: string }) => {
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.menuItemId === menuItemId);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], ...updates };
        return next;
      });
    },
    []
  );

  const handleHoldOrder = useCallback(() => {
    if (cart.length === 0) {
      toast("Add items before holding.");
      return;
    }
    const { orderType } = channelToBackendOrder(orderChannel);
    saveHeldOrder({
      label: `Hold ${new Date().toLocaleTimeString()}`,
      cart,
      customerName,
      phone,
      orderType,
      tableLabel: selectedTable?.displayName
    });
    setCart([]);
    toast("Order held");
  }, [cart, customerName, phone, orderChannel, selectedTable]);

  const handleResumeHeld = useCallback((held: HeldOrder) => {
    setBillMode("new");
    setSelectedOrderId(null);
    setCart(held.cart);
    setCustomerName(held.customerName ?? "");
    setPhone(held.phone ?? "");
    setOrderChannel(held.orderType === "dine_in" ? "dine_in" : "parcel");
    removeHeldOrder(held.id);
    toast("Held order resumed");
  }, []);

  const handleApplyCoupon = useCallback(async () => {
    setCouponError(null);
    const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const result = await validateCouponCode(couponCode, subtotal);
    if (!result.ok) {
      setCouponError(result.error);
      setCouponDiscount(0);
      return;
    }
    setCouponCode(result.code);
    setCouponDiscount(result.discount);
    setDiscountMode("coupon");
    setDiscountFlatAmount(result.discount);
    toast(`Coupon applied · −₹${result.discount}`);
  }, [cart, couponCode]);

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

  const resolvePaymentMethod = useCallback((): PaymentMethodId => {
    if (!paymentMethod) throw new Error("Select a payment method.");
    return paymentMethod === "split" ? "cash" : paymentMethod;
  }, [paymentMethod]);

  const printOrderDocs = useCallback(
    async (order: StaffOrderRow, method: PaymentMethodId) => {
      await printCashierOrderDocuments({ order, paymentMethod: method, taxPercent, printers, posSettings });
    },
    [taxPercent, printers, posSettings]
  );

  const checkoutOffline = useCallback(async (method: PaymentMethodId) => {
    if (!window.posApi) throw new Error("Local POS bridge unavailable.");
    const kitchenOrder = await window.posApi.checkout({
      source: platformToSource(platformFilter),
      paymentMethod: method,
      items: cart.map((line) => ({
        productId: Number(line.menuItemId) || 0,
        name: line.name,
        quantity: line.qty,
        price: line.unitPrice,
        notes: line.note
      }))
    });
    await window.posApi.emitNewOrder(kitchenOrder);
    return kitchenOrder;
  }, [cart, platformFilter]);

  const handlePayAndComplete = useCallback(async () => {
    if (!isParcelMode || cart.length === 0) return;
    if (!paymentMethod) {
      toast("Select a payment method.");
      return;
    }
    setBusy(true);
    try {
      const method = resolvePaymentMethod();
      const { orderType, source } = channelToBackendOrder("parcel");

      try {
        const placed = await confirmCashierPosOrder({
          orderType,
          source,
          lines: buildCartLinesForOrder(),
          tableNumber: selectedTable?.number,
          tableFirestoreId: selectedTable?.id,
          tableDisplayName: selectedTable?.displayName,
          customerName: customerName || undefined,
          phone: phone || undefined,
          paymentMethod: method,
          markPaid: true,
          couponCode: discountMode === "coupon" && couponCode ? couponCode : undefined,
          discountAmount: discountMode === "coupon" ? couponDiscount : discountMode === "flat" ? discountFlatAmount : undefined
        });
        const orderRow = {
          id: placed.orderId,
          items: placed.items.map((it) => ({ id: it.productId, name: it.name, price: it.unitPrice, qty: it.qty })),
          totalAmount: placed.total,
          tokenNumber: placed.tokenNumber,
          tableName: placed.tableLabel,
          orderType: "parcel",
          paymentStatus: "paid",
          status: "completed",
          canonicalStatus: "preparing"
        } as StaffOrderRow;
        await printOrderDocs(orderRow, method);
        setSelectedOrderId(placed.orderId);
        toast(`Paid · Token #${placed.tokenNumber}`);
      } catch {
        const local = await checkoutOffline(method);
        toast(`Saved offline · ${local.orderNumber}`);
      }

      setCart([]);
      setCashReceived("");
      setCouponCode("");
      setCouponDiscount(0);
      setPaymentMethod(null);
      setBillMode("existing");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }, [
    isParcelMode,
    cart,
    paymentMethod,
    resolvePaymentMethod,
    buildCartLinesForOrder,
    selectedTable,
    customerName,
    phone,
    discountMode,
    couponCode,
    couponDiscount,
    discountFlatAmount,
    printOrderDocs,
    checkoutOffline
  ]);

  const handleAcceptPayment = useCallback(async () => {
    if (!selectedOrder || !paymentMethod) return;
    setBusy(true);
    try {
      const method = resolvePaymentMethod();
      await markCashierOrderPaid(selectedOrder.id, method);
      await printOrderDocs(selectedOrder, method);
      toast("Payment completed");
      setSelectedOrderId(null);
      setPaymentMethod(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }, [selectedOrder, paymentMethod, resolvePaymentMethod, printOrderDocs]);

  const handleNewOrder = useCallback(() => {
    if (!isParcelMode) return;
    setBillMode("new");
    setSelectedOrderId(null);
    setCart([]);
    setCustomerName("");
    setPhone("");
    setPaymentMethod(null);
  }, [isParcelMode]);

  const runPrint = useCallback(
    async (order: StaffOrderRow) => {
      setBusy(true);
      try {
        await printOrderDocs(order, paymentMethod ?? "cash");
        toast("Sent to printers");
      } finally {
        setBusy(false);
      }
    },
    [paymentMethod, printOrderDocs]
  );

  const handleOpenOrderModal = useCallback(
    (order: StaffOrderRow) => {
      setSelectedOrderId(order.id);
      selectOrder(order.id);
      openOrderModal(order.id);
    },
    [selectOrder, openOrderModal]
  );

  const handleDuplicateParcelOrder = useCallback(async (order: StaffOrderRow) => {
    setBusy(true);
    try {
      const lines = order.items.map((it) => ({
        productId: it.id || it.name,
        name: it.name,
        unitPrice: it.price,
        qty: it.qty
      }));
      const placed = await confirmCashierPosOrder({
        orderType: "parcel",
        lines,
        customerName: order.customer?.name || undefined,
        phone: order.customer?.phone || undefined
      });
      toast(`Duplicated · Token #${placed.tokenNumber}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleCancelParcelOrder = useCallback(
    (order: StaffOrderRow, reason: string) => {
      if (order.id.startsWith("test-")) {
        cancelTestOrder(order.id, reason);
        toast("Test order cancelled");
        return;
      }
      toast("Contact manager to void an existing order.");
    },
    [cancelTestOrder]
  );

  const shortcutHandlers = useMemo(
    () => ({
      onFocusMenuSearch: () => menuSearchRef.current?.focus(),
      onNewOrder: handleNewOrder,
      onAcceptPayment: () => void handleAcceptPayment(),
      onPrint: () => selectedOrder && void runPrint(selectedOrder),
      onClearSelection: () => {
        setSelectedOrderId(null);
        setBillMode("existing");
      },
      onSelectPaymentMethod: (index: number) => {
        const m = CASHIER_PAYMENT_METHODS[index];
        if (m) setPaymentMethod(m);
      },
      onHold: handleHoldOrder,
      onDiscount: () => setDiscountPercent(10),
      onShowShortcuts: () => toast("F1 Search · F2 New · F3 Pay · F4 Print · F5 Hold · F6 Discount")
    }),
    [handleNewOrder, handleAcceptPayment, handleHoldOrder, selectedOrder, runPrint]
  );

  useCashierKeyboardShortcuts(shortcutHandlers, true);

  const billPanel = (
    <BillPaymentPanel
      mode={billMode}
      selectedOrder={selectedOrder}
      cartLines={cart}
      orderChannel={orderChannel}
      customerName={customerName}
      phone={phone}
      guestCount={guestCount}
      gstNumber={gstNumber}
      address={address}
      paymentMethod={paymentMethod}
      taxPercent={taxPercent}
      posSettings={posSettings}
      discountPercent={discountPercent}
      discountFlatAmount={discountMode === "coupon" ? couponDiscount : discountFlatAmount}
      couponCode={couponCode}
      couponError={couponError}
      cashReceived={cashReceived}
      serviceChargePercent={serviceChargePercent}
      busy={busy}
      discountMode={discountMode}
      splitLines={splitLines}
      onDiscountModeChange={setDiscountMode}
      onSplitChange={setSplitLines}
      onCouponCodeChange={setCouponCode}
      onApplyCoupon={() => void handleApplyCoupon()}
      onCashReceivedChange={setCashReceived}
      onHold={handleHoldOrder}
      onResumeHeld={handleResumeHeld}
      onCustomerNameChange={setCustomerName}
      onPhoneChange={setPhone}
      onGuestCountChange={setGuestCount}
      onGstChange={setGstNumber}
      onAddressChange={setAddress}
      onOrderChannelChange={setOrderChannel}
      onPaymentMethod={setPaymentMethod}
      onDiscountChange={(v) => (discountMode === "flat" ? setDiscountFlatAmount(v) : setDiscountPercent(v))}
      onServiceChargeChange={setServiceChargePercent}
      onCartQtyChange={onCartQtyChange}
      onCartLineModify={onCartLineModify}
      onRemoveCartLine={onRemoveCartLine}
      onPayAndComplete={() => void handlePayAndComplete()}
      onPayRazorpay={() => toast("Configure Razorpay in Admin → Settings")}
      onAcceptPayment={() => void handleAcceptPayment()}
      onPrint={() => selectedOrder && void runPrint(selectedOrder)}
      onRefund={() => toast("Refund requires manager approval")}
      onCancelOrder={() => {
        if (billMode === "new") {
          setCart([]);
          setBillMode("existing");
        } else toast("Contact manager to void order");
      }}
      onSaveDraft={() => toast(cart.length ? "Draft saved for session" : "Add items first")}
      tables={tables}
      selectedTableId={selectedTable?.id ?? null}
      onSelectTable={setSelectedTable}
    />
  );

  if (menuLoading && products.length === 0) {
    return (
      <div className="pos-loading-screen">
        <div className="pos-loading-spinner" />
        <p>Loading POS…</p>
      </div>
    );
  }

  return (
    <div className="pos-app">
      <PosNavbar
        cashierName={cashierName}
        counterNumber={2}
        unreadCount={notifications.length}
        syncOnline={syncStatus.online}
        onHistory={() => toast(`Today: ₹${metrics.todaySales} · ${metrics.todayOrders} orders`)}
        onHelp={shortcutHandlers.onShowShortcuts}
        onLogout={() => void signOut(getStaffAuth()!)}
      />

      <PosOrderSourceBar
        active={platformFilter}
        counts={platformCounts}
        onChange={setPlatformFilter}
      />

      <div className="pos-body">
        {!isParcelMode ? (
          <PosPlatformOrdersPanel
            platform={platformFilter}
            orders={visibleOrders}
            loading={ordersLoading}
            search={orderSearch}
            statusFilter={statusFilters[platformFilter]}
            statusCounts={activeStatusCounts}
            onStatusChange={(s) => setPlatformStatusFilter(platformFilter, s)}
            onSearchChange={setOrderSearch}
            onOpenOrder={handleOpenOrderModal}
            onPrint={(o) => void runPrint(o)}
            onPayment={(o) => {
              handleOpenOrderModal(o);
              setBillMode("existing");
              setSelectedOrderId(o.id);
            }}
          />
        ) : (
          <>
            {!sidebarCollapsed ? (
              <CategorySidebar
                categories={categories.filter((c) => c !== "all")}
                counts={categoryCounts}
                active={selectedCategory === "all" ? "All" : selectedCategory}
                onSelect={(cat) => setSelectedCategory(cat === "All" ? "all" : cat)}
              />
            ) : null}
            <MenuPanel
              products={visibleProducts}
              search={menuSearch}
              onSearchChange={setMenuSearch}
              cartQty={Object.fromEntries(Object.entries(cartQtyById).map(([k, v]) => [Number(k) || k, v]))}
              selectedProductId={null}
              onAdd={(p) => addToCart({ id: String(p.id), name: p.name, price: p.price })}
              onDec={(id) => decFromCart({ id: String(id) })}
              searchInputRef={menuSearchRef}
              headerAction={
                <RecentParcelOrdersButton count={todayParcelCount} onPress={() => setShowRecentParcelDrawer(true)} />
              }
              orderToolbar={
                <PosPlatformStatusFilter
                  platform="parcel"
                  activeStatus={statusFilters.parcel}
                  statusCounts={platformStatusCounts.parcel}
                  onStatusChange={(s) => setPlatformStatusFilter("parcel", s)}
                />
              }
              menuError={menuError}
            />
            {billPanel}
          </>
        )}
      </div>

      {isParcelMode ? (
        <PosBottomBar
          onNewOrder={handleNewOrder}
          onPrint={() => selectedOrder && void runPrint(selectedOrder)}
          onPay={() => void handleAcceptPayment()}
          onMore={shortcutHandlers.onShowShortcuts}
        />
      ) : null}

      <PosTestingFab />
      <PosTestingPanelModal />
      <PosRecentParcelDrawer
        visible={showRecentParcelDrawer}
        orders={filteredParcelOrders}
        loading={ordersLoading}
        todayCount={todayParcelCount}
        onClose={() => setShowRecentParcelDrawer(false)}
        onOpen={(o) => {
          setBillMode("existing");
          setSelectedOrderId(o.id);
          setCart([]);
        }}
        onEdit={(o) => {
          setBillMode("new");
          setCart(
            o.items.map((it, i) => ({
              menuItemId: it.id || `line_${i}`,
              name: it.name,
              unitPrice: it.price,
              qty: it.qty
            }))
          );
        }}
        onPrint={(o) => void runPrint(o)}
        onDuplicate={(o) => void handleDuplicateParcelOrder(o)}
        onCancel={handleCancelParcelOrder}
      />
      <PosOrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        busy={busy}
        onClose={closeOrderModal}
        onPrint={() => selectedOrder && void runPrint(selectedOrder)}
        onPayment={() => {
          closeOrderModal();
          setBillMode("existing");
        }}
        onAccept={() => toast("Order accepted")}
      />
    </div>
  );
}
