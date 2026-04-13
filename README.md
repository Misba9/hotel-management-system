# Nausheen Fruits Juice Center Platform

Production-ready full-stack restaurant ordering and management monorepo.

## 1) Complete Folder Structure

```text
/
├── apps/
│   ├── customer-web/        # Next.js 14 customer app
│   ├── staff-mobile/        # Expo React Native staff app
│   └── admin-dashboard/     # Next.js 14 admin app
├── functions/               # Firebase Cloud Functions (TypeScript)
├── lib/
│   ├── firebase/
│   ├── utils/
│   ├── hooks/
│   └── types/
├── components/
│   ├── ui/
│   └── shared/
├── docs/
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
└── storage.rules
```

## 2) Firestore Database Schema

Collections:

- `users`
- `roles`
- `menu_categories`
- `menu_items`
- `orders`
- `order_items`
- `payments`
- `addresses`
- `delivery_assignments`
- `staff`
- `inventory`
- `coupons`
- `notifications`
- `branches`

Indexes defined in `firestore.indexes.json`.

## 3) Firebase Security Rules

- Firestore RBAC rules in `firestore.rules`
- Storage access rules in `storage.rules`
- Role strategy documented in `docs/security-rbac.md`

## 4) Cloud Functions

Defined in `functions/src`:

- `placeOrder`, `updateKitchenStatus`, `updateDeliveryStatus`
- `verifyRazorpayPayment`, `razorpayWebhook`
- `onOrderStatusChanged`
- `getAdminAnalytics`
- `exportDailyOrdersCsv`
- `getUpsellSuggestions`, `grantLoyaltyPointsOnDelivered`
- `seedInitialData`, `healthCheck`

## 5) API Routes

Customer app (`apps/customer-web/src/app/api`):

- `/api/checkout`
- `/api/coupons/validate`
- `/api/tracking/[orderId]`
- `/api/upsell`

Admin app (`apps/admin-dashboard/src/app/api`):

- `/api/analytics`

## 6) Next.js Frontend Pages

Customer pages:

- `/`
- `/menu`
- `/cart`
- `/checkout`
- `/tracking`
- `/profile`
- `/orders`
- `/offers`

## 7) React Native Screens

Staff app screens:

- `LoginScreen`
- `RoleHomeScreen`
- Role panels for Delivery, Kitchen, Waiter, Cashier, Manager

## 8) Admin Dashboard Components

- KPI cards (`components/shared/kpi-card.tsx`)
- Orders chart (`apps/admin-dashboard/src/components/orders-chart.tsx`)
- Management modules: menu, inventory, coupons, staff, branches

## 9) Firebase — build & deploy (copy-paste)

Config file: `backend/firebase.json`. Default project in scripts: `nausheen-fruits` (change `--project` if needed).

**One-time**

```bash
npm install -g firebase-tools
firebase login
firebase use nausheen-fruits
```

**Cloud Functions — compile TypeScript**

```bash
npm run firebase:build
```

Same as: `npm run build:functions` (builds workspace `@nausheen/functions` → `backend/functions/dist`).

**Cloud Functions — deploy**

```bash
npm run firebase:deploy:functions
```

**Build + deploy functions in one step**

```bash
npm run firebase:release:functions
```

**Firestore rules + Storage rules**

```bash
npm run firebase:deploy:rules
```

**Firestore rules, indexes, and other Firestore config**

```bash
npm run firebase:deploy:firestore
```

**Hosting only** (targets in `backend/firebase.json`; ensure `out/` / build output exists if you use static hosting)

```bash
npm run firebase:deploy:hosting
```

**Everything** (functions + hosting + rules + indexes as defined in `firebase.json`)

```bash
npm run firebase:deploy:all
```

**Raw CLI equivalents** (from repo root)

```bash
firebase deploy --config backend/firebase.json --project nausheen-fruits --only functions
firebase deploy --config backend/firebase.json --project nausheen-fruits --only hosting
firebase deploy --config backend/firebase.json --project nausheen-fruits --only firestore:rules,storage
```

## 10) Other deployment

1. Install dependencies: `npm install`
2. Configure environment files from each app’s `.env.example`.
3. **Vercel (optional):** import `customer-web` and `admin-dashboard` as separate projects; set env vars from each app’s `.env.example`.
4. **Expo:** `npm run dev:mobile` locally; use EAS Build / Submit for store releases.

## 11) Environment Variables

- Root: `.env.example` (if present)
- Customer web: `customer-web/.env.example`
- Admin dashboard: `admin-dashboard/.env.example`
- Staff mobile: `staff-mobile/.env.example`
- Cloud Functions: configure secrets / env in Firebase for production

## Local Development

- Customer web: `npm run dev:customer`
- Admin dashboard: `npm run dev:admin`
- Staff mobile: `npm run dev:mobile`
- All web + Expo web: `npm run dev` (see terminal banner for ports)
- Typecheck all packages: `npm run typecheck`
