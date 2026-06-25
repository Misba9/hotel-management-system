/**
 * Single `orders/{orderId}` model used by POS, kitchen, delivery, admin, and customer.
 * Canonical lifecycle: new → accepted → preparing → ready → completed | cancelled.
 */
export {
  CANONICAL_ORDER_STATUSES,
  type CanonicalOrderStatus,
  type CanonicalPaymentStatus
} from "../types/order";

export { KITCHEN_ACTIVE_STATUSES } from "../utils/canonical-order-fields";
