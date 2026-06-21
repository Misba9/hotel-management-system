# Staff Desktop ↔ Staff Mobile Parity Report

Generated: 2025-06-21  
Source of truth: `staff-mobile`  
Target: `staff-desktop`

## Executive Summary

`staff-desktop` currently implements ~25% of `staff-mobile` functionality. The cashier screen has a basic 3-column layout but lacks platform orders, payment flows, modals, table management, and most business logic. Kitchen is functional; waiter and manager are read-only stubs. No delivery module, no profile page, no modal system.

---

## 1. Missing Modules

| Module | Mobile | Desktop | Gap |
|--------|--------|---------|-----|
| Login + session restore | ✅ Full | ⚠️ Partial | No remember-email, no `staff_users` hydration |
| Cashier POS | ✅ Full | ⚠️ ~15% | Missing platform tabs, payments, hold, coupons |
| Billing / KOT / Invoice | ✅ Full | ⚠️ Basic | No reprint, no split bill, no table bills |
| Payment (cash/UPI/card/split) | ✅ Full | ❌ | Hardcoded cash only |
| Kitchen KDS | ✅ Full | ✅ | Minor: auto-print KOT on new order |
| Table management | ✅ Full | ❌ | No open/close/merge/shift |
| Waiter workflow | ✅ Full | ❌ | Read-only table grid |
| Online / Swiggy / Zomato | ✅ In POS | ❌ | No platform order panels |
| Delivery | ✅ Full | ❌ | Routed to waiter stub |
| Manager dashboard | ✅ Full | ⚠️ ~30% | No rider assign, no order actions |
| Inventory | ❌ N/A | ❌ N/A | Not in mobile either |
| Reports | ❌ Metrics only | ❌ | Neither has full reports |
| Notifications | ✅ Push + in-POS | ⚠️ Sound only | No notification panel |
| Settings | ⚠️ Read-only POS | ✅ Printers | Mobile has no settings screen |
| Profile | ✅ `/profile` | ❌ | Missing |
| Offline sync | ⚠️ Banner only | ✅ SQLite queue | Desktop has better offline |
| Thermal printing | ⚠️ expo-print HTML | ✅ USB serial | Desktop has better printing |

---

## 2. Missing Screens

| Mobile Route | Desktop Equivalent | Status |
|--------------|-------------------|--------|
| `/login` | `/login` | Exists — needs remember login |
| `/cashier/billing` | `/cashier` | Stub — needs full PosDashboard |
| `/waiter` | `/waiter` | Read-only |
| `/waiter/order/[tableId]` | — | **Missing** |
| `/kitchen/orders` | `/kitchen` | Exists |
| `/delivery/deliveries` | — | **Missing** |
| `/delivery/[deliveryId]` | — | **Missing** |
| `/manager/dashboard` | `/manager` | Partial |
| `/profile` | — | **Missing** |
| — | `/settings` | Desktop-only (OK) |

---

## 3. Missing Functions / Services

### Orders (`services/orders.ts`)
- `subscribeRecentOrders`, `subscribeKitchenKdsOrders`, `subscribeWaiterOrders`
- `markCashierOrderPaid`, `kitchenMarkOrderReady`, `waiterMarkServed`
- `generateBillForOrder`, `applyOrderRowAction`

### Restaurant orders (`services/restaurant-orders.ts`)
- `confirmRestaurantOrder`, `confirmCashierPosOrder`
- `computePosBillTotals`, `printFinalInvoice`, `printKitchenTicketForStaffOrder`
- `CASHIER_PAYMENT_METHODS`, split payment support

### Tables (`services/tables.ts`)
- `subscribeAllTables`, `patchWaiterTable`

### Delivery (`services/delivery.ts`)
- Full delivery lifecycle + GPS + chat

### Manager (`services/manager.ts`)
- `subscribeStaffDirectory`, `assignDeliveryBoyToOrder`

### Table order workflows
- `placeTableOrder`, `requestTableOrderBill`, `confirmTableOrderPayment`
- `markTableOrderServed`, `acceptKitchenTableOrder`, `markKitchenTableOrderReady`

### POS libs (`src/lib/pos/*`)
- All 15+ modules missing from desktop

### Hooks (24 in mobile, 1 in desktop)
- Missing: `useCashierOrders`, `useCashierMenu`, `usePosSettings`, `usePrinters`
- Missing: `useCashierBillingQueue`, `useCashierTablePaymentQueue`
- Missing: `useWaiterFloorOrders`, `useTableActiveOrders`, `useKitchenQueue`
- Missing: `useCashierKeyboardShortcuts`, `useCashierDashboardMetrics`

---

## 4. Missing APIs

Desktop uses Firestore-direct order creation only. Mobile uses:
- Firestore realtime subscriptions (primary)
- Platform API for status PATCH (desktop has partial)
- No REST order ingest for Swiggy/Zomato (both rely on Firestore `source` field)

---

## 5. Missing Components (47+ in mobile POS alone)

### Cashier POS components not in desktop
- `PosDashboard`, `PosNavbar`, `PosOrderSourceBar`, `PosPlatformOrdersPanel`
- `MenuPanel`, `CategorySidebar`, `BillPaymentPanel`, `PosPaymentFlow`
- `PosSplitPayment`, `PosCustomerPanel`, `PosOrderDetailModal`
- `PosNotificationsPanel`, `PosDeliveryHub`, `PosRecentParcelDrawer`
- `ActiveOrdersPanel`, `PendingTableBillsPanel`, `CashierTableQueuePanel`
- `TransactionHistoryPanel`, `PosKitchenTracker`, `PosComboSection`
- `PosTestingPanel`, `TableStatusBar`, `DashboardSummaryCards`

### Waiter components
- `WaiterHomeView`, `RestaurantPosOrderScreen`, `AddItemModal`
- `TablePosGridCard`, `WaiterActiveOrderCard`

### Manager components
- `ManagerDashboardView`, `OrderCard` with lifecycle actions

### Delivery components
- `DeliveryHomeView`, `DeliveryDetailView`, `DeliveryCard`

### Shell / UX
- `OfflineBanner`, `Modal` system, `AppErrorBoundary`

---

## 6. Missing Dialogs / Modals

| Modal | Mobile | Desktop |
|-------|--------|---------|
| Order detail + actions | ✅ | ❌ |
| Item modifications | ✅ | ❌ |
| Platform status filter | ✅ | ❌ |
| POS notifications inbox | ✅ | ❌ |
| Delivery partner hub | ✅ | ❌ |
| Recent parcel drawer + cancel | ✅ | ❌ |
| Test order generator | ✅ | ❌ |
| Assign delivery rider | ✅ | ❌ |
| Waiter overflow menu | ✅ | ❌ |
| Add item to table order | ✅ | ❌ |
| Held orders resume | ✅ | ❌ |
| Keyboard shortcuts help | ✅ | ❌ |

---

## 7. Missing Permissions / RBAC

| Check | Mobile | Desktop |
|-------|--------|---------|
| Role shell guards | ✅ per layout | ✅ RoleGuard |
| `staff_users/{uid}` hydration | ✅ Zustand | ❌ uses `users/` only |
| Pending approval gate | ✅ | ⚠️ partial |
| `hasPermission` RBAC | ✅ | ❌ route-only |
| Cross-role URL blocking | ✅ | ✅ |

---

## 8. Layout Gaps

| Requirement | Status |
|-------------|--------|
| Top header (branch, user, shift, clock, notifications) | ❌ Basic header only |
| Collapsible left sidebar | ❌ Top nav only |
| 3-column cashier (categories / products / bill) | ⚠️ Exists but incomplete |
| Desktop grid (no mobile card stacking) | ⚠️ Partial |
| Keyboard shortcuts F1–F8 + ESC | ⚠️ F1,F2,F4,F8,ESC only |
| Dark / light mode | ❌ |
| Min 1366×768 layout | ⚠️ Responsive but not optimized |

---

## 9. Implementation Priority

1. **P0** — Port services + hooks from mobile (business logic layer)
2. **P0** — Full cashier PosDashboard with payments, platform orders, modals
3. **P0** — Desktop shell (sidebar, header, theme, all shortcuts)
4. **P1** — Waiter floor + table ordering screen
5. **P1** — Manager with order actions + rider assignment
6. **P1** — Auth alignment (`staff_users`, remember login)
7. **P2** — Delivery module
8. **P2** — Profile page
9. **P2** — Notification panel + toasts

---

## 10. Notes

- **Inventory** and **Reports** are not implemented in mobile either; desktop parity does not require inventing these.
- Desktop **offline SQLite** and **USB thermal printing** are ahead of mobile — preserve these.
- Mobile uses `staff_users` collection; desktop uses `users` — must align without breaking sync.
