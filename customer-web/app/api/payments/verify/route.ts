import crypto from "node:crypto";
import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

type VerifyPayload = {
  orderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
};

const verifySchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1)
});

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "customer_payment_verify", limit: 25, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const body = verifySchema.parse((await request.json()) as VerifyPayload);

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return Response.json({ success: false, error: "Razorpay secret not configured." }, { status: 500 });
    }

    const signedPayload = `${body.razorpayOrderId}|${body.razorpayPaymentId}`;
    const expectedSignature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
    if (expectedSignature !== body.razorpaySignature) {
      return Response.json({ success: false, error: "Invalid Razorpay signature." }, { status: 400 });
    }

    const paymentSnap = await adminDb.collection("payments").where("orderId", "==", body.orderId).limit(1).get();
    if (paymentSnap.empty) {
      return Response.json({ success: false, error: "Payment record not found." }, { status: 404 });
    }

    const paymentRef = paymentSnap.docs[0].ref;
    await paymentRef.update({
      status: "paid",
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      verifiedAt: new Date().toISOString()
    });

    await adminDb.collection("orders").doc(body.orderId).update({
      updatedAt: new Date().toISOString()
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid verification payload.", details: error.issues }, { status: 400 });
    }
    console.error("Payment verification error:", error);
    return Response.json({ success: false, error: "Payment verification failed." }, { status: 500 });
  }
}
