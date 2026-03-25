# Platform Backend v1

This folder provides production-ready backend primitives for:

- Authentication (customer/staff/admin role-aware login checks, OTP verification helper)
- Order lifecycle (create/update/cancel/assign delivery/realtime status feed)
- Payments (cash, UPI, online verification)
- Delivery (assignment, tracking, status updates)
- Admin controls (products, categories, staff, orders, sales reports, settings)

## Callable Functions

### Auth
- `completeLogin`
- `verifyOtpLogin`
- `bootstrapUserProfile`
- `setUserRoleByAdmin`
- `generateEmailVerificationLink`
- `generatePasswordResetLink`

### Orders
- `createOrderV1`
- `updateOrderStatusV1`
- `cancelOrderV1`
- `assignDeliveryPartnerV1`

### Payments
- `initiateOnlinePaymentV1`
- `verifyOnlinePaymentV1`
- `markCashPaymentV1`

### Delivery
- `updateDeliveryStatusV1`
- `updateDeliveryTrackingV1`
- `updateDeliveryAssignmentTrackingV1`

### Admin
- `upsertCategoryV1`
- `upsertProductV1`
- `upsertStaffV1`
- `listOrdersV1`
- `getSalesReportV1`
- `seedSettingsV1`
- `createAdminUserV1`

## HTTP API

`platformApiV1` supports:

- `POST /v1/orders`
- `PATCH /v1/orders/:orderId/status`
- `POST /v1/orders/:orderId/cancel`
- `POST /v1/delivery/assign`
- `GET /v1/admin/reports/sales?from=<iso>&to=<iso>`

All HTTP requests require `Authorization: Bearer <Firebase ID Token>`.
