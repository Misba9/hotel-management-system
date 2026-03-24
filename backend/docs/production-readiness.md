# Production Readiness Guide

## 1) Environment configuration

Use these templates before deployment:

- Root: `.env.production.example`
- Customer web: `apps/customer-web/.env.example`
- Admin dashboard: `apps/admin-dashboard/.env.example`
- Functions: `functions/.env.example`
- Staff mobile: `apps/staff-mobile/.env.example`

Minimum required variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `ERROR_MONITORING_ENABLED=true`

## 2) Firebase hosting setup

`firebase.json` is configured with:

- Hosting targets: `customer-web`, `admin-dashboard`
- Security headers:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
- Static asset caching: `max-age=31536000, immutable`

## 3) API security

All sensitive API routes now enforce:

- Bearer token authentication
- Role-based access control (RBAC)
- Endpoint-level rate limiting
- Input validation (`zod`) for write endpoints

Shared utility: `lib/utils/api-security.ts`

## 4) Logging and monitoring

Server logging and error capture utilities:

- `lib/utils/monitoring.ts`
  - structured info/error logs
  - persisted errors to Firestore collection `error_logs` when `ERROR_MONITORING_ENABLED=true`

Client error collection endpoints:

- `apps/customer-web/src/app/api/monitoring/error/route.ts`
- `apps/admin-dashboard/src/app/api/monitoring/error/route.ts`

Global error boundaries:

- `apps/customer-web/src/app/error.tsx`
- `apps/admin-dashboard/src/app/error.tsx`

## 5) CI/CD

### CI

Workflow: `.github/workflows/ci.yml`

- Typecheck all workspaces
- Build Cloud Functions

### Deployment

Workflow: `.github/workflows/deploy.yml`

- Trigger: push to `main` or manual dispatch
- Auth: `FIREBASE_SERVICE_ACCOUNT` GitHub secret
- Deploys:
  - Cloud Functions
  - Firestore rules
  - Storage rules
  - Hosting

Required GitHub secrets:

- `FIREBASE_SERVICE_ACCOUNT`
- `FIREBASE_PROJECT_ID`
