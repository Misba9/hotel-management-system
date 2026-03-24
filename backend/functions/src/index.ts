import { initializeApp } from "firebase-admin/app";
import { seedInitialData } from "./seed";
import { placeOrder, updateDeliveryStatus, updateKitchenStatus } from "./orders";
import { verifyRazorpayPayment, razorpayWebhook } from "./payments";
import { onOrderCreatedRealtimeAlerts, onOrderStatusChanged } from "./notifications";
import { getAdminAnalytics } from "./analytics";
import { exportDailyOrdersCsv } from "./reports";
import { getUpsellSuggestions, grantLoyaltyPointsOnDelivered } from "./growth";
import { healthCheck } from "./health";
import {
  bootstrapUserProfile,
  completeLogin,
  generateEmailVerificationLink,
  generatePasswordResetLink,
  setUserRoleByAdmin,
  verifyOtpLogin
} from "./v1/auth";
import { assignDeliveryPartnerV1, cancelOrderV1, createOrderV1, updateOrderStatusV1 } from "./v1/orders";
import { initiateOnlinePaymentV1, markCashPaymentV1, verifyOnlinePaymentV1 } from "./v1/payments";
import { updateDeliveryStatusV1, updateDeliveryTrackingV1 } from "./v1/delivery";
import {
  createAdminUserV1,
  getSalesReportV1,
  listOrdersV1,
  seedSettingsV1,
  upsertCategoryV1,
  upsertProductV1,
  upsertStaffV1
} from "./v1/admin";
import { platformApiV1 } from "./v1/api";

initializeApp();

export {
  seedInitialData,
  placeOrder,
  updateKitchenStatus,
  updateDeliveryStatus,
  verifyRazorpayPayment,
  razorpayWebhook,
  onOrderCreatedRealtimeAlerts,
  onOrderStatusChanged,
  getAdminAnalytics,
  exportDailyOrdersCsv,
  getUpsellSuggestions,
  grantLoyaltyPointsOnDelivered,
  healthCheck,
  completeLogin,
  verifyOtpLogin,
  bootstrapUserProfile,
  setUserRoleByAdmin,
  generateEmailVerificationLink,
  generatePasswordResetLink,
  createOrderV1,
  updateOrderStatusV1,
  cancelOrderV1,
  assignDeliveryPartnerV1,
  initiateOnlinePaymentV1,
  verifyOnlinePaymentV1,
  markCashPaymentV1,
  updateDeliveryStatusV1,
  updateDeliveryTrackingV1,
  upsertCategoryV1,
  upsertProductV1,
  upsertStaffV1,
  listOrdersV1,
  getSalesReportV1,
  seedSettingsV1,
  createAdminUserV1,
  platformApiV1
};
