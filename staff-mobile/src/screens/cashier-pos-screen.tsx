import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Platform, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FirebaseError } from "firebase/app";
import { collection, getDocs, limit, onSnapshot, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { staffDb, staffFunctions } from "../lib/firebase";
import { useStaffAuth } from "../context/staff-auth-context";
import { StaffErrorView } from "../components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { EmptyState } from "../components/ux/empty-state";
import { space } from "../theme/design-tokens";
import { staffColors } from "../theme/staff-ui";
import {
  CartBottomSheet,
  CategoryTabs,
  FloatingCartButton,
  ProductCard,
  SearchBar,
  type CartLine,
  type MenuItemDoc
} from "../components/cashier-pos";

export type { CartLine, MenuItemDoc } from "../components/cashier-pos";

function normalizeMenuItem(id: string, raw: Record<string, unknown>): MenuItemDoc | null {
  const available = raw.available !== false;
  if (!available) return null;
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  const price = Number(raw.price ?? 0);
  if (!Number.isFinite(price) || price < 0) return null;
  const imageUrl =
    typeof raw.imageUrl === "string"
      ? raw.imageUrl
      : typeof raw.image === "string"
        ? raw.image
        : null;
  return {
    id,
    name,
    price,
    category: typeof raw.category === "string" ? raw.category : undefined,
    categoryId: typeof raw.categoryId === "string" ? raw.categoryId : undefined,
    image: imageUrl,
    imageUrl,
    available: true
  };
}

async function resolveDefaultBranchId(): Promise<string | null> {
  const snap = await getDocs(query(collection(staffDb, "branches"), limit(25)));
  if (snap.empty) return null;
  const docs = snap.docs.map((d) => ({
    id: d.id,
    active: (d.data() as { active?: boolean }).active
  }));
  const preferred = docs.find((b) => b.active !== false);
  return (preferred ?? docs[0]).id;
}

/**
 * Cashier POS — modern layout: search, categories, grid, floating cart, bottom sheet.
 */
export function CashierPosScreen() {
  const { user } = useStaffAuth();
  const [menuItems, setMenuItems] = useState<MenuItemDoc[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchLoading, setBranchLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuListenerKey, setMenuListenerKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const itemById = useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    setMenuLoading(true);
    setMenuError(null);
    try {
      unsub = onSnapshot(
        collection(staffDb, "menu_items"),
        (snap) => {
          const list: MenuItemDoc[] = [];
          snap.forEach((docSnap) => {
            const row = normalizeMenuItem(docSnap.id, docSnap.data() as Record<string, unknown>);
            if (row) list.push(row);
          });
          list.sort((a, b) => a.name.localeCompare(b.name));
          setMenuItems(list);
          setMenuLoading(false);
          setRefreshing(false);
        },
        (err) => {
          setMenuError(err instanceof Error ? err.message : "Failed to load menu");
          setMenuLoading(false);
          setRefreshing(false);
        }
      );
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : "Failed to load menu");
      setMenuLoading(false);
      setRefreshing(false);
    }
    return () => {
      unsub?.();
    };
  }, [menuListenerKey]);

  const onMenuRefresh = useCallback(() => {
    setRefreshing(true);
    setMenuListenerKey((k) => k + 1);
  }, []);

  const retryMenu = useCallback(() => {
    setMenuError(null);
    setMenuLoading(true);
    setMenuListenerKey((k) => k + 1);
  }, []);

  useEffect(() => {
    void (async () => {
      setBranchLoading(true);
      try {
        const id = await resolveDefaultBranchId();
        setBranchId(id);
      } finally {
        setBranchLoading(false);
      }
    })();
  }, []);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => {
      const c = m.category?.trim() || m.categoryId?.trim();
      if (c) set.add(c);
    });
    return ["all", ...Array.from(set).sort()] as const;
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter((m) => {
      if (categoryFilter !== "all") {
        const cat = m.category?.trim() || m.categoryId?.trim() || "";
        if (cat !== categoryFilter) return false;
      }
      if (!q) return true;
      const name = m.name.toLowerCase();
      const cat = (m.category ?? m.categoryId ?? "").toLowerCase();
      return name.includes(q) || cat.includes(q);
    });
  }, [menuItems, search, categoryFilter]);

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const total = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
    [cartLines]
  );

  const itemCount = useMemo(() => cartLines.reduce((n, l) => n + l.qty, 0), [cartLines]);

  const addToCart = useCallback((item: MenuItemDoc) => {
    setCart((prev) => {
      const existing = prev[item.id];
      const qty = (existing?.qty ?? 0) + 1;
      return {
        ...prev,
        [item.id]: {
          menuItemId: item.id,
          name: item.name,
          unitPrice: item.price,
          qty
        }
      };
    });
  }, []);

  const decFromCart = useCallback((menuItemId: string) => {
    setCart((prev) => {
      const existing = prev[menuItemId];
      if (!existing) return prev;
      const qty = existing.qty - 1;
      if (qty <= 0) {
        const { [menuItemId]: _r, ...rest } = prev;
        return rest;
      }
      return { ...prev, [menuItemId]: { ...existing, qty } };
    });
  }, []);

  const incLine = useCallback(
    (menuItemId: string) => {
      const item = itemById.get(menuItemId);
      if (item) addToCart(item);
    },
    [itemById, addToCart]
  );

  const placeOrder = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert("Sign in required", "You must be signed in to place an order.");
      return;
    }
    if (!branchId) {
      Alert.alert("Branch missing", "Add at least one document to the `branches` collection in Firestore.");
      return;
    }
    if (cartLines.length === 0) {
      Alert.alert("Cart empty", "Add at least one menu item.");
      return;
    }

    setPlacing(true);
    try {
      const placeOrderFn = httpsCallable(staffFunctions, "placeOrder");
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const result = await placeOrderFn({
        branchId,
        orderType: "dine_in",
        paymentMethod: "cod",
        items: cartLines.map((line) => ({
          menuItemId: line.menuItemId,
          qty: line.qty
        })),
        idempotencyKey
      });
      const data = result.data as { orderId?: string; total?: number };
      setCart({});
      setCartOpen(false);
      Alert.alert(
        "Order placed",
        `Order #${data.orderId ?? "—"} • Total ₹${data.total ?? total.toFixed(0)}\nInvoice saved — kitchen notified.`
      );
    } catch (e) {
      const msg =
        e instanceof FirebaseError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not place order.";
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[CashierPOS] placeOrder failed:", e);
      }
      Alert.alert("Order failed", msg);
    } finally {
      setPlacing(false);
    }
  }, [user?.uid, branchId, cartLines, total]);

  const renderProduct = useCallback(
    ({ item }: { item: MenuItemDoc }) => {
      const qty = cart[item.id]?.qty ?? 0;
      return (
        <ProductCard item={item} qty={qty} onAdd={() => addToCart(item)} onDec={() => decFromCart(item.id)} />
      );
    },
    [cart, addToCart, decFromCart]
  );

  if (menuLoading || branchLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: staffColors.bg }} edges={["top", "bottom"]}>
        <StaffLoadingView message={branchLoading ? "Loading branch…" : "Loading menu…"} />
      </SafeAreaView>
    );
  }

  if (menuError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: staffColors.bg, padding: space.lg }} edges={["top", "bottom"]}>
        <StaffErrorView message={menuError} onRetry={retryMenu} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: staffColors.bg }} edges={["bottom"]}>
      <View style={{ flex: 1, position: "relative" }}>
        <SearchBar value={search} onChangeText={setSearch} />
        <CategoryTabs categories={categoryOptions} selected={categoryFilter} onSelect={setCategoryFilter} />

        <FlatList
          data={filteredItems}
          keyExtractor={(m) => m.id}
          numColumns={2}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 6,
            paddingBottom: Platform.OS === "web" ? 120 : 100
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onMenuRefresh}
              tintColor={staffColors.accent}
              colors={[staffColors.accent]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🔎"
              title="No matches"
              subtitle="Try another category or clear the search. Pull down to reload the menu."
            />
          }
          renderItem={renderProduct}
        />

        <CartBottomSheet
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          lines={cartLines}
          total={total}
          onInc={incLine}
          onDec={decFromCart}
          onPlaceOrder={() => void placeOrder()}
          placing={placing}
          canPlace={Boolean(branchId && cartLines.length > 0)}
        />

        <FloatingCartButton
          itemCount={itemCount}
          total={total}
          onPress={() => setCartOpen(true)}
          hidden={cartOpen}
        />
      </View>
    </SafeAreaView>
  );
}
