import { adminDb, adminRtdb } from "@shared/firebase/admin";
import { resolveRequestUser } from "@shared/utils/request-user";

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed", "preparing", "ready"]);

export async function POST(request: Request, context: { params: { orderId: string } }) {
  try {
    const orderId = context.params.orderId;
    if (!orderId) {
      return Response.json({ success: false, error: "Order ID is required." }, { status: 400 });
    }

    const user = await resolveRequestUser(request);
    if (user.userId === "guest:anonymous") {
      return Response.json({ success: false, error: "Missing guest identifier." }, { status: 400 });
    }

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
    if (!CANCELLABLE_STATUSES.has(currentStatus)) {
      return Response.json({ success: false, error: "Order can no longer be cancelled." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await orderRef.update({
      status: "cancelled",
      statusBucket: "completed",
      cancelledAt: now,
      updatedAt: now
    });
    await adminRtdb.ref(`orderFeeds/${orderId}`).update({
      status: "cancelled",
      updatedAt: now
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to cancel order.", error);
    return Response.json({ success: false, error: "Failed to cancel order." }, { status: 500 });
  }
}
