import { adminDb } from "@shared/firebase/admin";
import { resolveRequestUser } from "@shared/utils/request-user";
import { z } from "zod";
export const dynamic = "force-dynamic";

const cartItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  image: z.string().optional(),
  qty: z.number().int().min(1)
});

const cartSchema = z.object({
  userId: z.string().min(1),
  items: z.array(cartItemSchema).default([]),
  updatedAt: z.string()
});

const cartUpdateSchema = z.object({
  items: z.array(cartItemSchema)
});

function buildEmptyCart(userId: string) {
  return {
    userId,
    items: [],
    updatedAt: new Date().toISOString()
  };
}

export async function GET(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    if (user.userId === "guest:anonymous") {
      return Response.json({ success: true, cart: buildEmptyCart(user.userId) }, { status: 200 });
    }

    const cartRef = adminDb.collection("carts").doc(user.userId);
    const snap = await cartRef.get();
    if (!snap.exists) {
      const cart = buildEmptyCart(user.userId);
      await cartRef.set(cart);
      return Response.json({ success: true, cart }, { status: 200 });
    }

    const data = snap.data() as Record<string, unknown>;
    const parsed = cartSchema.safeParse({
      userId: String(data.userId ?? user.userId),
      items: Array.isArray(data.items) ? data.items : [],
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString()
    });
    if (!parsed.success) {
      const cart = buildEmptyCart(user.userId);
      await cartRef.set(cart, { merge: true });
      return Response.json({ success: true, cart }, { status: 200 });
    }

    return Response.json({ success: true, cart: parsed.data }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch cart.", error);
    return Response.json({ error: "Failed to fetch cart." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    if (user.userId === "guest:anonymous") {
      return Response.json({ success: false, error: "Missing guest identifier." }, { status: 400 });
    }

    const body = cartUpdateSchema.parse(await request.json());
    const cart = {
      userId: user.userId,
      items: body.items,
      updatedAt: new Date().toISOString()
    };
    await adminDb.collection("carts").doc(user.userId).set(cart, { merge: true });
    return Response.json({ success: true, cart }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }

    console.error("Failed to update cart.", error);
    return Response.json({ error: "Failed to update cart." }, { status: 500 });
  }
}
