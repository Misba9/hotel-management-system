import { adminDb } from "@shared/firebase/admin";
import { updateOrderFeed } from "@shared/utils/order-feed-firestore";
import { RequestUserAuthError, resolveRequestUser } from "@shared/utils/request-user";
import { CANCELLABLE_ORDER_STATUSES } from "@/lib/order-status-ui";

export async function POST(request: Request, context: { params: { orderId: string } }) {
  try {
    const orderId = context.params.orderId;
    if (!orderId) {
      return Response.json({ success: false, error: "Order ID is required." }, { status: 400 });
    }

    const user = await resolveRequestUser(request);

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return Response.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const order = orderSnap.data() as { userId?: string; status?: string };
    if (order.userId !== user.userId) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }
    const currentStatus = String(order.status ?? "pending");
    if (!CANCELLABLE_ORDER_STATUSES.has(currentStatus)) {
      return Response.json({ success: false, error: "Order can no longer be cancelled." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await orderRef.update({
      status: "cancelled",
      statusBucket: "completed",
      cancelledAt: now,
      updatedAt: now
    });
    await updateOrderFeed(orderId, {
      status: "cancelled",
      updatedAt: now
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestUserAuthError) {
      return Response.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    console.error("Failed to cancel order.", error);
    return Response.json({ success: false, error: "Failed to cancel order." }, { status: 500 });
  }
}
