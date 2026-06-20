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
  confirmCashierPosOrder,
  type PaymentMethodId
} from "../../../services/restaurant-orders";
import { staffAuth } from "../../lib/firebase";
import { useCashierOrders, useCashierOrdersSubscription } from "../../hooks/use-cashier-orders";
import { useCashierDashboardMetrics } from "../../hooks/use-cashier-dashboard-metrics";
import { useCashierKeyboardShortcuts } from "../../hooks/use-cashier-keyboard-shortcuts";
import { useCashierMenu } from "../../hooks/use-cashier-menu";
import { usePosSettings } from "../../hooks/use-pos-settings";
import { usePrinters } from "../../hooks/use-printers";
import { useTables } from "../../hooks/use-tables";
import { formatOrderTypeLabel, isOrderPaid } from "../../lib/cashier-order-filters";
import { printCashierOrderDocuments } from "../../lib/pos/cashier-print";
import { validateCouponCode } from "../../lib/pos/coupon-validate";
import { BillPaymentPanel, type BillMode } from "./bill-payment-panel";
import { MenuPanel } from "./menu-panel";
import { PosBottomBar } from "./pos-bottom-bar";
import { PosNavbar } from "./pos-navbar";
import { PosNotificationsPanel } from "./pos-notifications";
import { PosOrderSourceBar } from "./pos-order-source-bar";
import { PosPlatformStatusFilter } from "./pos-platform-status-filter";
import { PosQuickFab } from "./pos-quick-fab";
import { PosPlatformOrdersPanel } from "./pos-platform-orders-panel";
import { PosOrderDetailModal } from "./pos-order-detail-modal";
import { PosTestingFab, PosTestingPanelModal } from "./pos-testing-panel";
import { PosRecentParcelDrawer, RecentParcelOrdersButton } from "./pos-recent-parcel-drawer";
import { useCashierPosStore } from "../../lib/pos/cashier-pos-store";
import { filterParcelModuleOrders } from "../../lib/pos/cashier-orders-view";
import { removeHeldOrder, saveHeldOrder, type HeldOrder } from "../../lib/pos/hold-orders-store";
import { resolveOrderSource } from "../../lib/pos/order-source";
import { PosDeliveryHub } from "./pos-delivery-hub";
import type { CartLine, DiscountMode, MenuQuickFilter, PosNotification, PosOrderChannel, PosPanelTab, SplitPaymentLine } from "./pos-types";
import { channelToBackendOrder } from "./pos-types";
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

  const { products, grouped, categories, loading: menuLoading, error: menuError } = useCashierMenu(true);
  const { tables, loading: tablesLoading } = useTables(true);
  const { settings: posSettings, taxPercent } = usePosSettings();
  const { printers } = usePrinters();

  const activeTableCount = useMemo(() => tables.filter((t) => t.status === "occupied").length, [tables]);
  const metrics = useCashierDashboardMetrics(allOrders, activeTableCount);

  const [billMode, setBillMode] = useState<BillMode>("existing");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
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
  const activeStatusFilter = statusFilters[platformFilter];
  const activeStatusCounts = platformStatusCounts[platformFilter];

  const filteredParcelOrders = useMemo(
    () => filterParcelModuleOrders(parcelOrders, statusFilters.parcel, ""),
    [parcelOrders, statusFilters.parcel]
  );
  const [showDeliveryHub, setShowDeliveryHub] = useState(false);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [discountFlatAmount, setDiscountFlatAmount] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [menuQuickFilter, setMenuQuickFilter] = useState<MenuQuickFilter>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
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
  const [mobileTab, setMobileTab] = useState<PosPanelTab>("menu");
  const [showHistory, setShowHistory] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const menuSearchRef = useRef<TextInput | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const selectedOrder = useMemo(
    () => allOrders.find((o) => o.id === selectedOrderId) ?? null,
    [allOrders, selectedOrderId]
  );

  const cashierName = staffAuth?.currentUser?.displayName ?? staffAuth?.currentUser?.email?.split("@")[0];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const populateCustomerFromOrder = useCallback((order: StaffOrderRow) => {
    setCustomerName(order.customer?.name ?? "");
    setPhone(order.customer?.phone ?? "");
    setAddress(order.customer?.address ?? "");
    const raw = order as StaffOrderRow & Record<string, unknown>;
    setGstNumber(typeof raw.gstNumber === "string" ? raw.gstNumber : "");
  }, []);

  const orderToCart = useCallback((order: StaffOrderRow): CartLine[] => {
    const rawItems = order.items as Array<{
      id?: string;
      name: string;
      price: number;
      qty: number;
      note?: string;
      modifications?: string[];
    }>;
    return rawItems.map((it, i) => ({
      menuItemId: it.id || `line_${i}`,
      name: it.name,
      unitPrice: it.price,
      qty: it.qty,
      note: it.note,
      modifications: it.modifications
    }));
  }, []);

  const cartQtyById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const line of cart) m[line.menuItemId] = line.qty;
    return m;
  }, [cart]);

  const notifications = useMemo((): PosNotification[] => {
    const list: PosNotification[] = [];
    for (const o of allOrders) {
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
        list.push({ id: `sw-${o.id}`, title: "New Swiggy order", body: `Order ${o.id.slice(0, 8)}`, time: new Date(), kind: "swiggy" });
      }
      if (src === "zomato") {
        list.push({ id: `zo-${o.id}`, title: "New Zomato order", body: `Order ${o.id.slice(0, 8)}`, time: new Date(), kind: "zomato" });
      }
    }
    const lowStock = products.filter((p) => typeof p.stockQty === "number" && p.stockQty > 0 && p.stockQty < 5);
    if (lowStock.length > 0) {
      list.push({
        id: "stock",
        title: "Low stock alert",
        body: `${lowStock.length} items running low`,
        time: new Date(),
        kind: "stock"
      });
    }
    if (activeTableCount > 0) {
      list.push({
        id: "tables",
        title: "Customer waiting",
        body: `${activeTableCount} tables occupied`,
        time: new Date(),
        kind: "table"
      });
    }
    return list.slice(0, 20);
  }, [allOrders, products, activeTableCount]);

  const unreadCount = notificationsRead ? 0 : notifications.length;

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
      if (!isParcelMode) return;
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
    [billMode, trackRecent, isParcelMode]
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
    if (held.orderType === "dine_in") setOrderChannel("dine_in");
    else if (held.orderType === "parcel") setOrderChannel("parcel");
    else setOrderChannel("parcel");
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
    const { orderType } = channelToBackendOrder(orderChannel);
    saveHeldOrder({
      label: `Hold ${new Date().toLocaleTimeString()}`,
      cart,
      customerName,
      phone,
      orderType,
      tableLabel: selectedTable?.displayName,
      note: undefined
    });
    setCart([]);
    showToast("Order held — resume from Hold list");
  }, [cart, customerName, phone, orderChannel, selectedTable]);

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
    showToast(`Coupon applied · −₹${result.discount}`);
  }, [cart, couponCode]);

  const handleDiscountChange = useCallback((v: number) => {
    if (discountMode === "flat") {
      setDiscountFlatAmount(v);
      return;
    }
    if (v > 15) {
      Alert.alert("Manager approval", "Discounts above 15% require manager approval at the counter.");
    }
    setDiscountPercent(v);
  }, [discountMode]);

  const handleOpenParcelOrder = useCallback(
    (order: StaffOrderRow) => {
      setBillMode("existing");
      setSelectedOrderId(order.id);
      selectOrder(order.id);
      populateCustomerFromOrder(order);
      setCart([]);
      if (isMobile) setMobileTab("bill");
    },
    [selectOrder, populateCustomerFromOrder, isMobile]
  );

  const handleEditParcelOrder = useCallback(
    (order: StaffOrderRow) => {
      setBillMode("new");
      setSelectedOrderId(null);
      selectOrder(null);
      setCart(orderToCart(order));
      populateCustomerFromOrder(order);
      setOrderChannel("parcel");
      if (isMobile) setMobileTab("menu");
    },
    [selectOrder, orderToCart, populateCustomerFromOrder, isMobile]
  );

  const handleDuplicateParcelOrder = useCallback(
    async (order: StaffOrderRow) => {
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
        showToast(`Duplicated · Token #${placed.tokenNumber}`);
        setBillMode("existing");
        setSelectedOrderId(placed.orderId);
        populateCustomerFromOrder(order);
        if (isMobile) setMobileTab("bill");
      } catch (e) {
        Alert.alert("Duplicate failed", e instanceof Error ? e.message : "Unknown error");
      } finally {
        setBusy(false);
      }
    },
    [populateCustomerFromOrder, isMobile]
  );

  const handleCancelParcelOrder = useCallback(
    (order: StaffOrderRow, reason: string) => {
      if (order.id.startsWith("test-")) {
        cancelTestOrder(order.id, reason);
        showToast("Order cancelled");
        if (selectedOrderId === order.id) {
          setSelectedOrderId(null);
          setBillMode("new");
          setCart([]);
        }
        return;
      }
      Alert.alert("Cancel order", "Contact manager to void an existing order.", [{ text: "OK" }]);
    },
    [cancelTestOrder, selectedOrderId]
  );

  const handleOpenOrderModal = useCallback(
    (order: StaffOrderRow) => {
      setSelectedOrderId(order.id);
      selectOrder(order.id);
      openOrderModal(order.id);
    },
    [selectOrder, openOrderModal]
  );

  const handleNewOrder = useCallback(() => {
    if (!isParcelMode) return;
    setBillMode("new");
    setSelectedOrderId(null);
    setCart([]);
    setCustomerName("");
    setPhone("");
    setGuestCount("");
    setGstNumber("");
    setAddress("");
    setPaymentMethod(null);
    setDiscountPercent(0);
    setOrderChannel("parcel");
    if (isMobile || isTablet) setMobileTab("menu");
  }, [isMobile, isTablet, isParcelMode]);

  const buildCartLinesForOrder = useCallback(() => {
    return cart.map((l) => ({
      productId: l.menuItemId,
      name: l.name,
      unitPrice: l.unitPrice,
      qty: l.qty,
      ...(l.note ? { note: l.note } : {}),
      ...(l.modifications?.length ? { modifications: l.modifications } : {})
    }));
  }, [cart]);

  const resolvePaymentMethod = useCallback((): PaymentMethodId => {
    if (!paymentMethod) throw new Error("Select a payment method.");
    return paymentMethod === "split" ? "cash" : paymentMethod;
  }, [paymentMethod]);

  const printOrderDocs = useCallback(
    async (order: StaffOrderRow, method: PaymentMethodId) => {
      await printCashierOrderDocuments({
        order,
        paymentMethod: method,
        taxPercent,
        printers,
        posSettings
      });
    },
    [taxPercent, printers, posSettings]
  );

  const handlePayAndComplete = useCallback(async () => {
    if (!isParcelMode) return;
    if (cart.length === 0) {
      Alert.alert("Cart empty", "Add items from the menu first.");
      return;
    }
    if (!paymentMethod) {
      Alert.alert("Payment", "Select a payment method first.");
      return;
    }
    if (paymentMethod === "cash") {
      const received = Number(cashReceived) || 0;
      const due = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
      if (received < due) {
        Alert.alert("Cash", "Enter cash received (must cover total).");
        return;
      }
    }
    setBusy(true);
    try {
      const method = resolvePaymentMethod();
      const { orderType, source } = channelToBackendOrder("parcel");
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
      const orderRow: StaffOrderRow = {
        id: placed.orderId,
        items: placed.items.map((it) => ({
          id: it.productId,
          name: it.name,
          price: it.unitPrice,
          qty: it.qty
        })),
        totalAmount: placed.total,
        tokenNumber: placed.tokenNumber,
        tableName: placed.tableLabel,
        orderType: "parcel",
        paymentStatus: "paid",
        status: "completed",
        canonicalStatus: "preparing"
      } as StaffOrderRow;
      await printOrderDocs(orderRow, method);
      setCart([]);
      setCashReceived("");
      setCouponCode("");
      setCouponDiscount(0);
      setPaymentMethod(null);
      showToast(`Paid · Token #${placed.tokenNumber} · Printed`);
      setBillMode("existing");
      setSelectedOrderId(placed.orderId);
      if (isMobile) setMobileTab("orders");
    } catch (e) {
      Alert.alert("Payment failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [
    cart,
    paymentMethod,
    cashReceived,
    selectedTable,
    customerName,
    phone,
    isMobile,
    isParcelMode,
    buildCartLinesForOrder,
    resolvePaymentMethod,
    printOrderDocs,
    discountMode,
    couponCode,
    couponDiscount,
    discountFlatAmount
  ]);

  const handlePayRazorpay = useCallback(async () => {
    Alert.alert(
      "Razorpay",
      "Razorpay checkout opens on web when configured in Admin → Settings → Payments. Place order as pending and complete via customer checkout link, or use manual UPI."
    );
  }, []);

  const runPrint = useCallback(
    async (order: StaffOrderRow) => {
      setBusy(true);
      try {
        const method = paymentMethod ?? "cash";
        await printOrderDocs(order, method);
        showToast("Receipt & kitchen ticket sent to printers");
      } catch (e) {
        Alert.alert("Print failed", e instanceof Error ? e.message : "Unknown error");
      } finally {
        setBusy(false);
      }
    },
    [paymentMethod, printOrderDocs]
  );

  const handleAcceptPayment = useCallback(async () => {
    if (!selectedOrder || !paymentMethod) return;
    setBusy(true);
    try {
      const method = resolvePaymentMethod();
      await markCashierOrderPaid(selectedOrder.id, method);
      await printOrderDocs(selectedOrder, method);
      showToast("Payment completed · Printed");
      setSelectedOrderId(null);
      setPaymentMethod(null);
      setCashReceived("");
    } catch (e) {
      Alert.alert("Payment failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [selectedOrder, paymentMethod, resolvePaymentMethod, printOrderDocs]);

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

  const handleCancelOrder = useCallback(() => {
    if (billMode === "new") {
      Alert.alert("Cancel order", "Clear cart and discard this order?", [
        { text: "Keep", style: "cancel" },
        { text: "Cancel Order", style: "destructive", onPress: () => { setCart([]); setBillMode("existing"); } }
      ]);
      return;
    }
    Alert.alert("Cancel order", "Contact manager to void an existing order.");
  }, [billMode]);

  const handleSaveDraft = useCallback(() => {
    if (cart.length === 0) {
      Alert.alert("Draft", "Add items before saving a draft.");
      return;
    }
    showToast("Draft saved for this session");
  }, [cart.length]);

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
      onDiscount: handleQuickDiscount,
      onCustomer: () => setMobileTab("bill"),
      onKitchen: () => selectedOrder && setMobileTab("bill"),
      onBarcodeScan: handleBarcodeScan,
      onShowShortcuts: () =>
        Alert.alert(
          "Keyboard shortcuts",
          "F1 Search · F2 New · F3 Pay · F4 Print · F5 Hold · F6 Discount · F7 Customer · F8 Kitchen · / Menu · Ctrl+B Barcode · Esc Clear"
        )
    }),
    [handleNewOrder, handleAcceptPayment, handleHoldOrder, handleQuickDiscount, handleBarcodeScan, selectedOrder, runPrint]
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
      orderChannel={orderChannel}
      customerName={customerName}
      phone={phone}
      tableLabel={tableLabel}
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
      orders={allOrders}
      discountMode={discountMode}
      splitLines={splitLines}
      onDiscountModeChange={(m) => {
        setDiscountMode(m);
        if (m !== "coupon") {
          setCouponError(null);
        }
      }}
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
      onDiscountChange={handleDiscountChange}
      onServiceChargeChange={setServiceChargePercent}
      onCartQtyChange={onCartQtyChange}
      onCartLineModify={onCartLineModify}
      onRemoveCartLine={onRemoveCartLine}
      onPayAndComplete={() => void handlePayAndComplete()}
      onPayRazorpay={() => void handlePayRazorpay()}
      onAcceptPayment={() => void handleAcceptPayment()}
      onPrint={() => selectedOrder && void runPrint(selectedOrder)}
      onRefund={() => handleRefund()}
      onCancelOrder={handleCancelOrder}
      onSaveDraft={handleSaveDraft}
      tables={tables}
      selectedTableId={selectedTable?.id ?? null}
      onSelectTable={setSelectedTable}
      tablesLoading={tablesLoading}
    />
  );

  const platformOrdersPanel = (
    <PosPlatformOrdersPanel
      platform={platformFilter}
      orders={visibleOrders}
      loading={ordersLoading}
      search={orderSearch}
      statusFilter={activeStatusFilter}
      statusCounts={activeStatusCounts}
      onStatusChange={(s) => setPlatformStatusFilter(platformFilter, s)}
      onSearchChange={setOrderSearch}
      onOpenOrder={handleOpenOrderModal}
      onRefresh={() => undefined}
      onAccept={(o) => handleOpenOrderModal(o)}
      onReject={() => Alert.alert("Reject", "Contact manager to reject aggregator orders.")}
      onPrint={(o) => void runPrint(o)}
      onAssignKitchen={(o) => { handleOpenOrderModal(o); showToast("Sent to kitchen"); }}
      onMarkReady={() => showToast("Marked ready")}
      onMarkDelivered={() => showToast("Marked delivered")}
      onPayment={(o) => { handleOpenOrderModal(o); setMobileTab("bill"); }}
      onClose={() => showToast("Order closed")}
    />
  );

  const categorySidebar = !sidebarCollapsed ? (
    <CategorySidebar
      categories={categories}
      grouped={grouped}
      selectedCategory={selectedCategory}
      onCategorySelect={(cat) => {
        setMenuQuickFilter("all");
        setSelectedCategory(cat);
      }}
      onQuickFilter={setMenuQuickFilter}
      compact={isMobile}
    />
  ) : null;

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
      onBarcodeScan={handleBarcodeScan}
      onQuickDiscount={handleQuickDiscount}
      headerAction={
        isParcelMode ? (
          <RecentParcelOrdersButton
            count={todayParcelCount}
            onPress={() => setShowRecentParcelDrawer(true)}
          />
        ) : undefined
      }
      orderToolbar={
        isParcelMode ? (
          <PosPlatformStatusFilter
            platform="parcel"
            activeStatus={statusFilters.parcel}
            statusCounts={platformStatusCounts.parcel}
            onStatusChange={(s) => setPlatformStatusFilter("parcel", s)}
            fullWidth={isMobile}
          />
        ) : undefined
      }
    />
  );

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <PosNavbar
        restaurantName="Nausheen Fruits Juice Center"
        branchName="Main Branch"
        cashierName={cashierName}
        counterNumber={2}
        unreadCount={unreadCount}
        onMenuToggle={isDesktop ? () => setSidebarCollapsed((v) => !v) : undefined}
        onHistory={() => setShowHistory(true)}
        onNotifications={() => setShowNotifications(true)}
        onDelivery={() => setShowDeliveryHub(true)}
        onSettings={() => Alert.alert("Settings", "Cashier settings are read-only. Contact manager for changes.")}
        onProfile={() => router.push("/profile")}
        onLogout={() => void handleLogout()}
        onHelp={shortcutHandlers.onShowShortcuts}
      />

      <PosOrderSourceBar
        activePlatform={platformFilter}
        platformCounts={platformCounts}
        onPlatformChange={setPlatformFilter}
      />

      <View style={styles.main}>
        {!isParcelMode ? (
          platformOrdersPanel
        ) : isDesktop ? (
          <View style={styles.desktopWorkspace}>
            {categorySidebar}
            <View style={styles.colMenu}>{menuPanel}</View>
            <View style={styles.colBill}>{billPanel}</View>
          </View>
        ) : isTablet ? (
          <>
            <View style={styles.tabletWorkspace}>
              {categorySidebar}
              <View style={styles.tabletCenter}>
                {mobileTab === "menu" ? menuPanel : billPanel}
              </View>
            </View>
            <View style={styles.tabBar}>
              {(["menu", "bill"] as const).map((tab) => (
                <TabBtn key={tab} label={tab === "menu" ? "Products" : "Bill"} active={mobileTab === tab} onPress={() => setMobileTab(tab)} />
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.mobileBody}>
              {mobileTab === "menu" ? (
                <>
                  {categorySidebar}
                  {menuPanel}
                </>
              ) : (
                billPanel
              )}
            </View>
          </>
        )}
      </View>

      {isMobile && isParcelMode ? (
        <View style={styles.mobileTabs}>
          {(["menu", "bill"] as const).map((tab) => (
            <TabBtn
              key={tab}
              label={tab === "menu" ? "Menu" : "Bill"}
              active={mobileTab === tab}
              onPress={() => setMobileTab(tab)}
            />
          ))}
        </View>
      ) : null}

      {isParcelMode ? (
        <PosBottomBar
          isMobile={isMobile}
          onNewOrder={handleNewOrder}
          onPrint={() => selectedOrder && void runPrint(selectedOrder)}
          onPay={() => void handleAcceptPayment()}
          onMore={shortcutHandlers.onShowShortcuts}
        />
      ) : null}

      {!isMobile && isParcelMode ? (
        <PosQuickFab
          onNewOrder={handleNewOrder}
          onNewCustomer={() => setMobileTab("bill")}
          onExpense={() => Alert.alert("Expense", "Record drawer expense with manager PIN.")}
          onCashIn={() => Alert.alert("Cash In", "Record cash added to drawer.")}
          onCashOut={() => Alert.alert("Cash Out", "Record cash removed from drawer.")}
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
        onOpen={handleOpenParcelOrder}
        onEdit={handleEditParcelOrder}
        onPrint={(o) => void runPrint(o)}
        onDuplicate={(o) => void handleDuplicateParcelOrder(o)}
        onCancel={handleCancelParcelOrder}
      />
      <PosOrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        busy={busy}
        onClose={closeOrderModal}
        onAccept={() => showToast("Order accepted")}
        onReject={() => Alert.alert("Reject", "Contact manager to reject this order.")}
        onSendKitchen={() => showToast("Sent to kitchen")}
        onReady={() => showToast("Marked ready")}
        onPayment={() => { closeOrderModal(); if (isMobile) setMobileTab("bill"); }}
        onPrint={() => selectedOrder && void runPrint(selectedOrder)}
      />

      <TransactionHistoryPanel
        visible={showHistory}
        orders={allOrders}
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
        orders={allOrders}
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
  colMenu: { flex: 1, minWidth: 300 },
  colBill: { width: "32%", minWidth: 300, maxWidth: 400 },
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
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: "transparent"
  },
  tabBtnOn: { borderTopColor: posColors.primary, backgroundColor: posColors.primaryMuted },
  tabText: { fontSize: 12, fontWeight: "800", color: posColors.textDim },
  tabTextOn: { color: posColors.primary }
});
