import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  useWindowDimensions
} from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import type { StaffOrderRow } from "../../../services/orders";
import { markCashierOrderPaid } from "../../../services/orders";
import {
  CASHIER_PAYMENT_METHODS,
  DEFAULT_INVOICE_TAX_PERCENT,
  PAYMENT_METHOD_LABELS,
  calculateBillTotals,
  confirmCashierPosOrder,
  printFinalInvoice,
  staffOrderItemsToCartLines,
  type PaymentMethodId
} from "../../../services/restaurant-orders";
import { staffAuth } from "../../lib/firebase";
import { useCashierActiveOrders } from "../../hooks/use-cashier-active-orders";
import { useCashierKeyboardShortcuts } from "../../hooks/use-cashier-keyboard-shortcuts";
import { useCashierMenu } from "../../hooks/use-cashier-menu";
import { useTables } from "../../hooks/use-tables";
import { filterCashierOrders, formatOrderTypeLabel, isOrderPaid } from "../../lib/cashier-order-filters";
import { ActiveOrdersPanel } from "./active-orders-panel";
import { BillPaymentPanel, type BillMode } from "./bill-payment-panel";
import { MenuPanel } from "./menu-panel";
import { PosBottomBar } from "./pos-bottom-bar";
import { PosNavbar } from "./pos-navbar";
import { PosNotificationsPanel } from "./pos-notifications";
import { removeHeldOrder, saveHeldOrder, type HeldOrder } from "../../lib/pos/hold-orders-store";
import { resolveOrderSource } from "../../lib/pos/order-source";
import { PosDeliveryHub } from "./pos-delivery-hub";
import type { CartLine, DiscountMode, MenuQuickFilter, OrderSourceKey, OrderStatusFilter, PosNotification, PosPanelTab, SplitPaymentLine } from "./pos-types";
import { CategorySidebar } from "./category-sidebar";
import { posColors } from "./pos-theme";
import { TransactionHistoryPanel } from "./transaction-history-panel";
import type { FloorTable } from "../../hooks/use-tables";

function showToast(msg: string) {
  if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
}

export function PosDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const isMobile = width < 768;

  const { orders, loading: ordersLoading } = useCashierActiveOrders(true);
  const { products, grouped, categories, loading: menuLoading, error: menuError } = useCashierMenu(true);
  const { tables, loading: tablesLoading } = useTables(true);

  const [billMode, setBillMode] = useState<BillMode>("existing");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<OrderSourceKey>("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDeliveryHub, setShowDeliveryHub] = useState(false);
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing" | "new">("walkin");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [menuQuickFilter, setMenuQuickFilter] = useState<MenuQuickFilter>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const [newOrderType, setNewOrderType] = useState<"dine_in" | "parcel" | "online">("parcel");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [serviceChargePercent, setServiceChargePercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mobileTab, setMobileTab] = useState<PosPanelTab>("orders");
  const [showHistory, setShowHistory] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);

  const orderSearchRef = useRef<TextInput | null>(null);
  const menuSearchRef = useRef<TextInput | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const filteredOrders = useMemo(
    () => filterCashierOrders(orders, { search, source: sourceFilter, status: statusFilter }),
    [orders, search, sourceFilter, statusFilter, refreshKey]
  );

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (billMode === "existing" && !selectedOrderId && filteredOrders.length > 0) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [billMode, filteredOrders, selectedOrderId]);

  const cartQtyById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const line of cart) m[line.menuItemId] = line.qty;
    return m;
  }, [cart]);

  const notifications = useMemo((): PosNotification[] => {
    const list: PosNotification[] = [];
    for (const o of orders) {
      if (!isOrderPaid(o.paymentStatus) && (o.canonicalStatus === "ready" || o.canonicalStatus === "served")) {
        list.push({
          id: `pay-${o.id}`,
          title: "Payment pending",
          body: `Order ${o.id.slice(0, 8)} ready for checkout`,
          time: new Date(),
          kind: "payment"
        });
      }
      if (o.canonicalStatus === "ready") {
        list.push({
          id: `kit-${o.id}`,
          title: "Kitchen ready",
          body: `Token ${o.tokenNumber ?? "—"} is ready`,
          time: new Date(),
          kind: "kitchen"
        });
      }
      const src = resolveOrderSource(o);
      if (src === "swiggy") {
        list.push({ id: `sw-${o.id}`, title: "Swiggy order", body: `New order ${o.id.slice(0, 8)}`, time: new Date(), kind: "swiggy" });
      }
      if (src === "zomato") {
        list.push({ id: `zo-${o.id}`, title: "Zomato order", body: `New order ${o.id.slice(0, 8)}`, time: new Date(), kind: "zomato" });
      }
    }
    const occupied = tables.filter((t) => t.status === "occupied").length;
    if (occupied > 0) {
      list.push({
        id: "tables",
        title: `${occupied} tables occupied`,
        body: "Floor status updated live",
        time: new Date(),
        kind: "table"
      });
    }
    return list.slice(0, 20);
  }, [orders, tables]);

  const unreadCount = notificationsRead ? 0 : notifications.length;

  const productCols = isDesktop ? 4 : isTablet ? 3 : 2;

  const handleQuickDiscount = useCallback(() => {
    setMobileTab("bill");
    setDiscountPercent(10);
  }, []);

  const handleBarcodeScan = useCallback(() => {
    Alert.alert("Barcode", "Connect your scanner or enter SKU in product search.");
    menuSearchRef.current?.focus();
  }, []);

  const trackRecent = useCallback((id: string) => {
    setRecentProductIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 12));
  }, []);

  const addToCart = useCallback(
    (item: { id: string; name: string; price: number }) => {
      trackRecent(item.id);
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
    [billMode, trackRecent]
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

  const addComboToCart = useCallback((lines: CartLine[]) => {
    setCart((prev) => {
      const next = [...prev];
      for (const line of lines) {
        const idx = next.findIndex((l) => l.menuItemId === line.menuItemId);
        if (idx < 0) next.push(line);
        else next[idx] = { ...next[idx], qty: next[idx].qty + line.qty };
      }
      return next;
    });
    if (billMode === "existing") {
      setBillMode("new");
      setSelectedOrderId(null);
    }
  }, [billMode]);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleResumeHeld = useCallback((held: HeldOrder) => {
    setBillMode("new");
    setSelectedOrderId(null);
    setCart(held.cart);
    setCustomerName(held.customerName ?? "");
    setPhone(held.phone ?? "");
    setOrderNote(held.note ?? "");
    if (held.orderType === "dine_in" || held.orderType === "parcel" || held.orderType === "online") {
      setNewOrderType(held.orderType);
    }
    if (held.tableLabel) {
      const match = tables.find((t) => t.displayName === held.tableLabel);
      if (match) setSelectedTable(match);
    }
    removeHeldOrder(held.id);
    setMobileTab("bill");
    showToast("Held order resumed");
  }, [tables]);

  const handleHoldOrder = useCallback(() => {
    if (cart.length === 0) {
      Alert.alert("Hold", "Add items before holding an order.");
      return;
    }
    saveHeldOrder({
      label: `Hold ${new Date().toLocaleTimeString()}`,
      cart,
      customerName,
      phone,
      orderType: newOrderType,
      tableLabel: selectedTable?.displayName,
      note: orderNote
    });
    setCart([]);
    showToast("Order held — resume from Hold list");
  }, [cart, customerName, phone, newOrderType, selectedTable, orderNote]);

  const handleDiscountChange = useCallback((v: number) => {
    if (v > 15) {
      Alert.alert("Manager approval", "Discounts above 15% require manager approval at the counter.");
    }
    setDiscountPercent(v);
  }, []);

  const handleSelectOrder = useCallback(
    (order: StaffOrderRow) => {
      setBillMode("existing");
      setSelectedOrderId(order.id);
      setCart([]);
      if (isMobile) setMobileTab("bill");
    },
    [isMobile]
  );

  const handleNewOrder = useCallback(() => {
    setBillMode("new");
    setSelectedOrderId(null);
    setCart([]);
    setCustomerName("");
    setPhone("");
    setPaymentMethod(null);
    setDiscountPercent(0);
    if (isMobile) setMobileTab("menu");
    else if (isTablet) setMobileTab("menu");
  }, [isMobile, isTablet]);

  const handleSendToKitchen = useCallback(async () => {
    if (cart.length === 0) {
      Alert.alert("Cart empty", "Add items from the menu first.");
      return;
    }
    if (newOrderType === "dine_in" && !selectedTable) {
      Alert.alert("Table required", "Select a table for dine-in orders.");
      return;
    }
    setBusy(true);
    try {
      const lines = cart.map((l) => ({
        productId: l.menuItemId,
        name: l.name,
        unitPrice: l.unitPrice,
        qty: l.qty
      }));
      const placed = await confirmCashierPosOrder({
        orderType: newOrderType,
        lines,
        tableNumber: selectedTable?.number,
        tableFirestoreId: selectedTable?.id,
        tableDisplayName: selectedTable?.displayName,
        customerName: customerName || undefined,
        phone: phone || undefined
      });
      setCart([]);
      showToast(`Order sent · Token #${placed.tokenNumber}`);
      setBillMode("existing");
      setSelectedOrderId(placed.orderId);
      if (isMobile) setMobileTab("orders");
    } catch (e) {
      Alert.alert("Could not place order", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [cart, newOrderType, selectedTable, customerName, phone, isMobile]);

  const runPrint = useCallback(
    async (order: StaffOrderRow) => {
      setBusy(true);
      try {
        const method = paymentMethod ?? "cash";
        const lines = staffOrderItemsToCartLines(order.items);
        const { subtotal, taxAmount, grandTotal, taxPercent } = calculateBillTotals(
          order.totalAmount,
          DEFAULT_INVOICE_TAX_PERCENT
        );
        const token = typeof order.tokenNumber === "number" && order.tokenNumber > 0 ? `#${order.tokenNumber}` : "—";
        const table =
          order.tableName ??
          (typeof order.tableNumber === "number" ? `Table ${order.tableNumber}` : formatOrderTypeLabel(order.orderType));
        await printFinalInvoice({
          orderIdShort: order.id.slice(0, 10).toUpperCase(),
          tableLabel: table,
          tokenLabel: token,
          items: lines,
          subtotal,
          taxPercent,
          taxAmount,
          grandTotal,
          paymentMethodLabel: PAYMENT_METHOD_LABELS[method]
        });
        showToast("Receipt sent to printer");
      } catch (e) {
        Alert.alert("Print failed", e instanceof Error ? e.message : "Unknown error");
      } finally {
        setBusy(false);
      }
    },
    [paymentMethod]
  );

  const handleAcceptPayment = useCallback(async () => {
    if (!selectedOrder || !paymentMethod) return;
    setBusy(true);
    try {
      const method = paymentMethod === "split" ? "cash" : paymentMethod === "wallet" ? "wallet" : paymentMethod;
      await markCashierOrderPaid(selectedOrder.id, method);
      showToast("Payment completed");
      setSelectedOrderId(null);
      setPaymentMethod(null);
    } catch (e) {
      Alert.alert("Payment failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [selectedOrder, paymentMethod]);

  const handleRefund = useCallback(
    (order?: StaffOrderRow) => {
      const target = order ?? selectedOrder;
      if (!target) return;
      Alert.alert(
        "Refund",
        `Refund for ${target.id.slice(0, 8).toUpperCase()} must be approved by a manager.`,
        [{ text: "OK" }]
      );
    },
    [selectedOrder]
  );

  const handleLogout = useCallback(async () => {
    try {
      if (staffAuth) await signOut(staffAuth);
      router.replace("/login");
    } catch (e) {
      Alert.alert("Logout failed", e instanceof Error ? e.message : "Try again");
    }
  }, [router]);

  const shortcutHandlers = useMemo(
    () => ({
      onFocusOrderSearch: () => orderSearchRef.current?.focus(),
      onFocusMenuSearch: () => menuSearchRef.current?.focus(),
      onNewOrder: handleNewOrder,
      onAcceptPayment: () => void handleAcceptPayment(),
      onPrint: () => {
        if (selectedOrder) void runPrint(selectedOrder);
      },
      onClearSelection: () => {
        setSelectedOrderId(null);
        setBillMode("existing");
      },
      onSelectPaymentMethod: (index: number) => {
        const m = CASHIER_PAYMENT_METHODS[index];
        if (m) setPaymentMethod(m);
      },
      onToggleHistory: () => setShowHistory((v) => !v),
      onHold: handleHoldOrder,
      onDiscount: () => setMobileTab("bill"),
      onCustomer: () => setMobileTab("bill"),
      onKitchen: () => selectedOrder && setMobileTab("bill"),
      onShowShortcuts: () =>
        Alert.alert(
          "Keyboard shortcuts",
          "F1 Search · F2 New · F3 Pay · F4 Print · F5 Hold · F6 Discount · F7 Customer · F8 Kitchen · F9 History · / Menu · Esc Clear"
        )
    }),
    [handleNewOrder, handleAcceptPayment, handleHoldOrder, selectedOrder, runPrint]
  );

  useCashierKeyboardShortcuts(shortcutHandlers, true);

  const tableLabel = selectedTable
    ? selectedTable.displayName ?? `Table ${selectedTable.number}`
    : selectedOrder?.tableName ?? "";

  const billPanel = (
    <BillPaymentPanel
      mode={billMode}
      selectedOrder={selectedOrder}
      cartLines={cart}
      newOrderType={newOrderType}
      customerName={customerName}
      phone={phone}
      tableLabel={tableLabel}
      paymentMethod={paymentMethod}
      discountPercent={discountPercent}
      serviceChargePercent={serviceChargePercent}
      busy={busy}
      orders={orders}
      customerMode={customerMode}
      discountMode={discountMode}
      splitLines={splitLines}
      orderNote={orderNote}
      onCustomerModeChange={setCustomerMode}
      onDiscountModeChange={setDiscountMode}
      onSplitChange={setSplitLines}
      onOrderNoteChange={setOrderNote}
      onHold={handleHoldOrder}
      onResumeHeld={handleResumeHeld}
      onCustomerNameChange={setCustomerName}
      onPhoneChange={setPhone}
      onNewOrderTypeChange={setNewOrderType}
      onPaymentMethod={setPaymentMethod}
      onDiscountChange={handleDiscountChange}
      onServiceChargeChange={setServiceChargePercent}
      onCartQtyChange={onCartQtyChange}
      onRemoveCartLine={onRemoveCartLine}
      onSendToKitchen={() => void handleSendToKitchen()}
      onAcceptPayment={() => void handleAcceptPayment()}
      onPrint={() => selectedOrder && void runPrint(selectedOrder)}
      onRefund={() => handleRefund()}
      tables={tables}
      selectedTableId={selectedTable?.id ?? null}
      onSelectTable={setSelectedTable}
      tablesLoading={tablesLoading}
    />
  );

  const ordersQueue = (
    <ActiveOrdersPanel
      orders={filteredOrders}
      loading={ordersLoading}
      selectedId={selectedOrderId}
      search={search}
      sourceFilter={sourceFilter}
      statusFilter={statusFilter}
      onSearchChange={setSearch}
      onSourceFilter={setSourceFilter}
      onStatusFilter={setStatusFilter}
      onSelect={handleSelectOrder}
      onNewOrder={handleNewOrder}
      onRefresh={() => setRefreshKey((k) => k + 1)}
      searchInputRef={orderSearchRef}
      layout={isMobile && mobileTab !== "orders" ? "bottom" : isDesktop || isTablet ? "bottom" : "sidebar"}
    />
  );

  const categorySidebar = (
    <CategorySidebar
      categories={categories}
      grouped={grouped}
      selectedCategory={selectedCategory}
      onCategorySelect={(cat) => {
        setMenuQuickFilter("all");
        setSelectedCategory(cat);
      }}
      compact={isMobile}
    />
  );

  const menuPanel = (
    <MenuPanel
      products={products}
      grouped={grouped}
      categories={categories}
      selectedCategory={selectedCategory}
      quickFilter={menuQuickFilter}
      search={menuSearch}
      cartQtyById={cartQtyById}
      recentProductIds={recentProductIds}
      loading={menuLoading}
      error={menuError}
      onCategorySelect={setSelectedCategory}
      onQuickFilter={setMenuQuickFilter}
      onSearchChange={setMenuSearch}
      onAdd={(item) => addToCart(item)}
      onDec={(item) => decFromCart(item)}
      onAddCombo={addComboToCart}
      favoriteIds={favoriteIds}
      onToggleFavorite={toggleFavorite}
      searchInputRef={menuSearchRef}
      showCategoryTabs={isMobile}
      numColumns={productCols}
      onBarcodeScan={handleBarcodeScan}
      onQuickDiscount={handleQuickDiscount}
    />
  );

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <PosNavbar
        restaurantName="Nausheen Fruits Juice Center"
        branchName="Main Branch"
        unreadCount={unreadCount}
        onHistory={() => setShowHistory(true)}
        onNotifications={() => setShowNotifications(true)}
        onMessages={() => Alert.alert("Messages", "Manager messages will appear here.")}
        onDelivery={() => setShowDeliveryHub(true)}
        onSettings={() => Alert.alert("Settings", "Cashier settings are read-only. Contact manager for changes.")}
        onProfile={() => router.push("/profile")}
        onLogout={() => void handleLogout()}
        onHelp={shortcutHandlers.onShowShortcuts}
      />

      <View style={styles.main}>
        {isDesktop ? (
          <>
            <View style={styles.desktopWorkspace}>
              {categorySidebar}
              <View style={styles.colMenu}>{menuPanel}</View>
              <View style={styles.colBill}>{billPanel}</View>
            </View>
            {ordersQueue}
          </>
        ) : isTablet ? (
          <>
            <View style={styles.tabletWorkspace}>
              {mobileTab === "orders" ? (
                ordersQueue
              ) : (
                <>
                  {categorySidebar}
                  <View style={styles.tabletCenter}>
                    {mobileTab === "menu" ? menuPanel : billPanel}
                  </View>
                </>
              )}
            </View>
            {mobileTab !== "orders" ? ordersQueue : null}
            <View style={styles.tabBar}>
              {(["orders", "menu", "bill"] as const).map((tab) => (
                <TabBtn key={tab} label={tab === "orders" ? "Orders" : tab === "menu" ? "Products" : "Bill"} active={mobileTab === tab} onPress={() => setMobileTab(tab)} />
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.mobileBody}>
              {mobileTab === "orders" ? (
                <ActiveOrdersPanel
                  orders={filteredOrders}
                  loading={ordersLoading}
                  selectedId={selectedOrderId}
                  search={search}
                  sourceFilter={sourceFilter}
                  statusFilter={statusFilter}
                  onSearchChange={setSearch}
                  onSourceFilter={setSourceFilter}
                  onStatusFilter={setStatusFilter}
                  onSelect={handleSelectOrder}
                  onNewOrder={handleNewOrder}
                  onRefresh={() => setRefreshKey((k) => k + 1)}
                  searchInputRef={orderSearchRef}
                  layout="sidebar"
                />
              ) : mobileTab === "menu" ? (
                <>
                  {categorySidebar}
                  {menuPanel}
                </>
              ) : (
                billPanel
              )}
            </View>
            {mobileTab !== "orders" ? ordersQueue : null}
          </>
        )}
      </View>

      {isMobile ? (
        <View style={styles.mobileTabs}>
          {(["orders", "menu", "bill"] as const).map((tab) => (
            <TabBtn
              key={tab}
              label={tab === "orders" ? "Orders" : tab === "menu" ? "Menu" : "Bill"}
              active={mobileTab === tab}
              onPress={() => setMobileTab(tab)}
            />
          ))}
        </View>
      ) : null}

      <PosBottomBar
        isMobile={isMobile}
        onNewOrder={handleNewOrder}
        onPrint={() => selectedOrder && void runPrint(selectedOrder)}
        onPay={() => void handleAcceptPayment()}
        onMore={shortcutHandlers.onShowShortcuts}
      />

      <TransactionHistoryPanel
        visible={showHistory}
        orders={orders}
        onClose={() => setShowHistory(false)}
        onReprint={(o) => void runPrint(o)}
        onRefund={handleRefund}
      />
      <PosNotificationsPanel
        visible={showNotifications}
        notifications={notifications}
        unreadCount={unreadCount}
        onClose={() => setShowNotifications(false)}
        onMarkRead={() => {
          setNotificationsRead(true);
          setShowNotifications(false);
        }}
      />
      <PosDeliveryHub
        visible={showDeliveryHub}
        orders={orders}
        onClose={() => setShowDeliveryHub(false)}
        onPrint={(o) => void runPrint(o)}
      />
    </Animated.View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnOn]}>
      <Text style={[styles.tabText, active && styles.tabTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: posColors.bg },
  main: { flex: 1, minHeight: 0 },
  desktopWorkspace: { flex: 1, flexDirection: "row", minHeight: 0 },
  colMenu: { flex: 1, minWidth: 320 },
  colBill: { width: "34%", minWidth: 320, maxWidth: 420 },
  tabletWorkspace: { flex: 1, flexDirection: "row", minHeight: 0 },
  tabletCenter: { flex: 1, minWidth: 0 },
  mobileBody: { flex: 1, minHeight: 0 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: posColors.border,
    backgroundColor: posColors.secondary
  },
  mobileTabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: posColors.border,
    backgroundColor: posColors.secondary,
    paddingBottom: Platform.OS === "ios" ? 8 : 0
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: "transparent"
  },
  tabBtnOn: { borderTopColor: posColors.primary, backgroundColor: posColors.primaryMuted },
  tabText: { fontSize: 12, fontWeight: "800", color: posColors.textDim },
  tabTextOn: { color: posColors.primary }
});
