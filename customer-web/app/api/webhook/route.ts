import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { verifyRazorpayWebhookSignature } from "@shared/utils/razorpay-webhook-verify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PaymentEntity = {
  id?: string;
  order_id?: string;
  status?: string;
  error_code?: string;
  error_description?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: PaymentEntity };
  };
};

/**
 * POST — Razorpay webhooks (`payment.captured`, `payment.failed`).
 * Verifies `X-Razorpay-Signature` against the **raw** body using `RAZORPAY_WEBHOOK_SECRET`.
 * Updates `orders` where `razorpayOrderId` matches (order is created after client verify; webhook confirms or reconciles).
 */
export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "razorpay_webhook", limit: 300, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!secret) {
    return Response.json({ error: "Webhook secret not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const sig =
    request.headers.get("x-razorpay-signature") ??
    request.headers.get("X-Razorpay-Signature") ??
    "";

  if (!verifyRazorpayWebhookSignature(rawBody, sig, secret)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const event = body.event ?? "";
  const entity = body.payload?.payment?.entity;

  try {
    if (event === "payment.captured") {
      await handlePaymentCaptured(entity);
    } else if (event === "payment.failed") {
      await handlePaymentFailed(entity);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[webhook]", e);
    }
    return Response.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return Response.json({ received: true }, { status: 200 });
}

async function handlePaymentCaptured(entity: PaymentEntity | undefined) {
  const rzOrderId = entity?.order_id;
  const paymentId = entity?.id;
  if (!rzOrderId || !paymentId) return;

  const snap = await adminDb.collection("orders").where("razorpayOrderId", "==", rzOrderId).limit(1).get();
  if (snap.empty) {
    return;
  }

  const ref = snap.docs[0].ref;
  const data = snap.docs[0].data();
  if (String(data.paymentStatus ?? "") === "paid" && String(data.razorpayPaymentId ?? "") === paymentId) {
    return;
  }

  await ref.set(
    {
      paymentStatus: "paid",
      razorpayPaymentId: paymentId,
      paymentVerifiedBy: "webhook",
      paymentWebhookAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

async function handlePaymentFailed(entity: PaymentEntity | undefined) {
  const rzOrderId = entity?.order_id;
  if (!rzOrderId) return;

  const snap = await adminDb.collection("orders").where("razorpayOrderId", "==", rzOrderId).limit(1).get();
  if (snap.empty) {
    return;
  }

  const ref = snap.docs[0].ref;
  const data = snap.docs[0].data();
  if (String(data.paymentStatus ?? "") === "paid") {
    return;
  }

  const reason =
    [entity?.error_description, entity?.error_code].filter((x) => typeof x === "string" && x.trim()).join(" · ") ||
    "payment_failed";

  await ref.set(
    {
      paymentStatus: "failed",
      paymentFailureReason: reason.slice(0, 500),
      paymentWebhookAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}
