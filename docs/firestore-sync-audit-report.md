# Restaurant Platform Sync — Implementation Report

**Date:** 2026-06-22  
**Scope:** Admin Panel, Customer Website, Staff Desktop (Cashier + Kitchen), Staff Mobile (Waiter + Kitchen)

---

## Executive Summary

All apps share **one Firestore collection**: `orders/{orderId}`. No duplicate order collections exist in the database. The breakage was caused by **inconsistent status values**, **wrong query filters**, and **UI layers that hid valid orders**.

This pass implements **canonical field normalization**, **full kitchen lifecycle actions**, **realtime listeners everywhere orders are listed**, and **cross-app display consistency** for table, customer, source, modifiers, and payment fields.

---

## Issues Found & Fixed

### 1. Order sync (Waiter → Kitchen/Cashier/Admin)

| Issue | Fix |
|-------|-----|
| Waiter wrote `preparing`; kitchen queried `PLACED`/`PREPARING` | Waiter writes `status: "new"`; kitchen queries `new\|accepted\|preparing\|ready` |
| Desktop kitchen hid `new` tickets (`activeOrders` filter) | `useKitchenOrders` includes `new`, `accepted`, `preparing` |
| Mobile kitchen filtered `pending\|preparing` only | `KitchenView` uses `isActivePipelineStatus()` |
| `orderType == "table"` queries missed `dine_in` writes | All dine-in hooks use `orderType in ["dine_in","table","dine-in"]` |

**Realtime:** `subscribeKitchenKdsOrders`, `subscribeWaiterOrders`, `subscribeAllOrders`, admin `onSnapshot` — no order polling in staff apps.

### 2. Kitchen status sync (Kitchen → Waiter/Cashier/Admin)

| Issue | Fix |
|-------|-----|
| No accept step; cashier jumped `new` → `preparing` | `acceptChannelOrder` writes `accepted`; kitchen has `kitchenAcceptOrder` |
| Kitchen desktop had no Accept button | `KitchenDashboard` — Accept / Preparing / Ready actions |
| Mobile kitchen only had Print + Done | `KitchenTicketCard` — Accept / Preparing / Ready + modifiers |
| Waiter showed hardcoded "Preparing" badge | Live `formatKitchenStatusLabel(canonicalStatus)` |
| Admin KDS columns missed `new` | Columns use `normalizeOrderStatus()` → canonical buckets |

**Canonical lifecycle:** `new` → `accepted` → `preparing` → `ready` → `completed` | `cancelled`

### 3. Table details

Standardized on all order writes/reads:
- `tableId` — Firestore doc id
- `tableNumber` — numeric
- `tableName` — display label

`extractTableFields()` in `shared/utils/canonical-order-fields.ts` used in `enrichOrder()`.

Table occupancy: `useTableOrderTableSync` listens dine-in orders and sets `tables/{id}.status` to `OCCUPIED`/`FREE`.

### 4. Order details

| Field | Implementation |
|-------|----------------|
| Order number | `tokenNumber` or `#id` suffix via `formatOrderNumber()` |
| Table | `tableId`, `tableNumber`, `tableName` |
| Order type | `orderType` (`dine_in`, `parcel`, `online`) |
| Order source | `source` field + `resolveOrderSource()` badges |
| Customer | `customerName`, `customerPhone` (+ legacy `customer` object) |
| Modifiers/notes | `items[].modifications`, `items[].note`, order `notes` |
| Quantity/price | `items[].qty`, `items[].price` |
| Total | `total` / `totalAmount` |
| Payment status | `pending` \| `paid` \| `refunded` |
| Kitchen status | canonical `status` field |

### 5. Order source standardization

Supported sources: **waiter**, **dine_in**, **parcel**, **swiggy**, **zomato**, **website**, **online**

- `shared/constants/order-source.ts` — metadata (label, emoji, color)
- `resolveOrderSource()` / `getOrderSourceMeta()` in staff POS libs
- Badges on kitchen cards (desktop + mobile) and cashier platform panels

### 6. Firestore structure

**Confirmed:** Only `orders/{orderId}` stores orders.  
`kitchenOrders`, `activeOrders`, `waiterOrders`, `cashierOrders` are **in-memory filtered arrays only**.

### 7–8. Status & payment standardization

**Status writes** now use lowercase canonical values only.  
**Read path** maps legacy (`PLACED`, `READY`, `SERVED`, `pending`, etc.) via `normalizeOrderStatus()`.

**Payment:** `pending` | `paid` | `refunded` — `markCashierOrderPaid` no longer forces `completed` while food is still in kitchen (mobile aligned with desktop).

### 9. Realtime table management

- Waiter opens table → order created → `patchWaiterTable({ status: "OCCUPIED" })`
- `useTableOrderTableSync` frees table when order reaches `completed`/`cancelled`
- `placeTableOrder` sets `tables/{id}.currentOrderId` + `occupied`

### 10. Cashier panel

- `useCashierTablePaymentQueue` — realtime query: dine-in + `status == ready` + `paymentStatus == pending`
- `resolveWorkflowStatus()` uses shared normalization
- `acceptChannelOrder` → `accepted` (not `preparing`)

### 11. Kitchen panel

- Desktop: full pipeline UI with modifiers, source, table, notes
- Mobile: same pipeline + `formatItemExtras` for modifiers
- Auto KOT prints on `new`/`accepted`/`preparing` tickets

### 12. Waiter mobile

- `subscribeWaiterOrders` — realtime dine-in orders
- Active orders show live kitchen + payment status
- Pending payments only when `ready` + `paymentStatus pending` (no overlap with active pipeline)

### 13. Shared types

```
shared/types/order.ts
shared/types/table.ts
shared/types/customer.ts
shared/utils/canonical-order-fields.ts
shared/utils/order-display.ts
shared/constants/order-source.ts
```

---

## Files Modified (this session + prior audit)

### Shared
- `shared/types/order.ts`, `table.ts`, `customer.ts`
- `shared/utils/canonical-order-fields.ts`, `order-display.ts`
- `shared/constants/order-source.ts`, `unified-order.ts`

### Staff Desktop
- `src/services/orders.ts`, `order-workflow.ts`, `restaurant-orders.ts`
- `src/services/firestore-orders-core.js`, `place-table-order.ts`
- `src/services/mark-table-order-served.ts`, `update-kitchen-table-order.ts`
- `src/hooks/useKitchenOrders.ts`, `use-waiter-floor-orders.ts`
- `src/hooks/use-table-order-table-sync.ts`, `use-cashier-table-payment-queue.ts`
- `src/pages/KitchenDashboard.tsx`
- `src/lib/kds-utils.ts`, `pos/order-workflow-status.ts`

### Staff Mobile
- `services/orders.ts`, `restaurant-orders.ts`
- `src/services/orders.js`, `place-table-order.ts`
- `src/services/mark-table-order-served.ts`, `update-kitchen-table-order.ts`
- `src/hooks/use-waiter-floor-orders.ts`, `use-table-order-table-sync.ts`
- `src/hooks/use-cashier-table-payment-queue.ts`
- `components/Kitchen/KitchenView.tsx`, `KitchenTicketCard.tsx`
- `components/Waiter/WaiterHomeView.tsx`
- `tsconfig.json` (added `@shared/lib/*` path)

### Admin Dashboard
- `src/features/kitchen/kitchen-display-page.tsx`

---

## Database Changes

**No schema migration required** — canonical values are written on new orders; legacy documents are normalized on read.

**Recommended production backfill** (manual script):
```javascript
// For each orders doc with legacy status:
// PLACED/pending/created → new
// PREPARING → preparing
// READY → ready
// SERVED/done → completed
// REQUESTED/PAID → pending/paid (paymentStatus)
```

---

## End-to-End Workflow (After Fix)

```
Waiter Mobile: create order (status=new, source=waiter, tableId/Number/Name)
    ↓ onSnapshot (instant)
Kitchen Desktop/Mobile: sees "new" → Accept → Preparing → Ready
    ↓ onSnapshot (instant)
Waiter Mobile: badge updates (New → Accepted → Preparing → Ready)
    ↓ onSnapshot (instant)
Cashier Desktop: sees ready + payment pending
Cashier: mark paid (paymentStatus=paid; status=completed if ready)
    ↓ onSnapshot (instant)
Waiter Mobile: shows Paid; table → Available (table sync hook)
Admin Panel: order moves to Completed column
```

---

## Remaining Issues

| Item | Priority | Notes |
|------|----------|-------|
| Production Firestore backfill | High | Legacy docs still have uppercase/mixed statuses |
| Firestore security rules | High | May still validate `PLACED`/`PREPARING` uppercase |
| Android native KitchenActivity.kt | Medium | Queries `pending`/`preparing`; use Expo kitchen route instead |
| `staff-web` app | N/A | Does not exist — use `staff-desktop` |
| Customer-web delivery statuses | Low | `out_for_delivery`/`delivered` map to `completed` on read |
| Mobile cashier pending bill panels | Low | `PendingTableBillsPanel` exported but not mounted in `pos-dashboard` |
| Admin PATCH `/api/orders/[id]` | Medium | Still accepts many legacy override statuses |

---

## Verification

- `staff-desktop`: `tsc --noEmit` ✅
- `staff-mobile`: `tsc --noEmit` ✅

---

## No Duplicate Collections

| Collection | Role |
|------------|------|
| `orders/{orderId}` | **Single source of truth** |
| `invoices/{orderId}` | Billing mirror |
| `tables/{tableId}` | Floor plan |
| `deliveries/{id}` | Rider assignment |
| `orderFeeds/{orderId}` | Customer notifications |

All order UIs are **filtered realtime views** of `orders`, not separate stores.
