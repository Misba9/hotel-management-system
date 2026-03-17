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

## 9) Deployment Steps

1. Install dependencies:
   - `npm install`
2. Configure environment files from `.env.example`.
3. Firebase:
   - `firebase login`
   - `firebase use <project-id>`
   - `npm run build:functions`
   - `firebase deploy --only functions,firestore,storage`
4. Vercel:
   - import `apps/customer-web` and `apps/admin-dashboard` as separate projects
   - configure env vars from app `.env.example`
5. Expo:
   - `npm run dev:mobile`
   - configure EAS and publish for Android/iOS

## 10) Environment Variables

- Root: `.env.example`
- Customer web: `apps/customer-web/.env.example`
- Admin dashboard: `apps/admin-dashboard/.env.example`
- Staff mobile: `apps/staff-mobile/.env.example`
- Functions: `functions/.env.example`

## Local Development

- Customer web: `npm run dev:customer`
- Admin dashboard: `npm run dev:admin`
- Staff mobile: `npm run dev:mobile`
- Typecheck all packages: `npm run typecheck`
