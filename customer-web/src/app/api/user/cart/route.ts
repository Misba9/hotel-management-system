import { adminDb } from "@shared/firebase/admin";
import { RequestUserAuthError, resolveRequestUser } from "@shared/utils/request-user";
import { z } from "zod";
export const dynamic = "force-dynamic";

const cartItemSchema = z
  .object({
    productId: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    price: z.number().min(0),
    image: z.string().optional(),
    quantity: z.number().int().min(1).optional(),
    qty: z.number().int().min(1).optional()
  })
  .transform((row) => {
    const productId = row.productId ?? row.id ?? "";
    const quantity = row.quantity ?? row.qty ?? 0;
    return {
      productId,
      name: row.name,
      price: row.price,
      image: row.image ?? "",
      quantity
    };
  })
  .refine((row) => row.productId.length > 0, { message: "productId or id required" })
  .refine((row) => row.quantity >= 1, { message: "quantity or qty must be >= 1" });

const cartItemStoredSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  image: z.string(),
  quantity: z.number().int().min(1)
});

const cartSchema = z.object({
  userId: z.string().min(1),
  items: z.array(cartItemStoredSchema).default([]),
  updatedAt: z.string()
});

const cartUpdateSchema = z.object({
  items: z.array(cartItemSchema)
});

function buildEmptyCart(userId: string) {
  return {
    userId,
    items: [] as z.infer<typeof cartItemStoredSchema>[],
    updatedAt: new Date().toISOString()
  };
}

function coerceCartItems(raw: unknown[]): z.infer<typeof cartItemStoredSchema>[] {
  const out: z.infer<typeof cartItemStoredSchema>[] = [];
  for (const entry of raw) {
    const parsed = cartItemSchema.safeParse(entry);
    if (parsed.success) {
      out.push({
        productId: parsed.data.productId,
        name: parsed.data.name,
        price: parsed.data.price,
        image: parsed.data.image,
        quantity: parsed.data.quantity
      });
    }
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const user = await resolveRequestUser(request);

    const cartRef = adminDb.collection("carts").doc(user.userId);
    const snap = await cartRef.get();
    if (!snap.exists) {
      const cart = buildEmptyCart(user.userId);
      await cartRef.set(cart);
      return Response.json({ success: true, cart }, { status: 200 });
    }

    const data = snap.data() as Record<string, unknown>;
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const coerced = coerceCartItems(rawItems);
    const parsed = cartSchema.safeParse({
      userId: String(data.userId ?? user.userId),
      items: coerced,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString()
    });
    if (!parsed.success) {
      const cart = buildEmptyCart(user.userId);
      await cartRef.set(cart, { merge: true });
      return Response.json({ success: true, cart }, { status: 200 });
    }

    return Response.json({ success: true, cart: parsed.data }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestUserAuthError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    console.error("Failed to fetch cart.", error);
    return Response.json({ error: "Failed to fetch cart." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await resolveRequestUser(request);

    const body = cartUpdateSchema.parse(await request.json());
    const items = body.items.map((row) => ({
      productId: row.productId,
      name: row.name,
      price: row.price,
      image: row.image ?? "",
      quantity: row.quantity
    }));
    const cart = {
      userId: user.userId,
      items,
      updatedAt: new Date().toISOString()
    };
    await adminDb.collection("carts").doc(user.userId).set(cart, { merge: true });
    return Response.json({ success: true, cart }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestUserAuthError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }

    console.error("Failed to update cart.", error);
    return Response.json({ error: "Failed to update cart." }, { status: 500 });
  }
}
