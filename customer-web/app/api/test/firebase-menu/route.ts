import { adminDb } from "@shared/firebase/admin";

const MAX_LIMIT = 50;

type MenuProductDoc = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName: string;
  description?: string;
  available?: boolean;
};

type MenuCategoryDoc = {
  id: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
};

function jsonError(message: string, status: number, hint?: string) {
  return Response.json({ ok: false as const, error: message, ...(hint ? { hint } : {}) }, { status });
}

function authorizeTestWrite(request: Request): boolean {
  const secret = process.env.MENU_TEST_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-menu-test-secret");
    const auth = request.headers.get("authorization");
    return header === secret || auth === `Bearer ${secret}`;
  }
  return process.env.NODE_ENV === "development";
}

/**
 * GET — Verify Firebase Admin + Firestore read, return sample menu documents.
 * Query: ?limit=20 (max 50)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "20") || 20, 1), MAX_LIMIT);

    await adminDb.collection("products").limit(1).get();

    const [productsSnap, categoriesSnap] = await Promise.all([
      adminDb.collection("products").limit(limit).get(),
      adminDb.collection("categories").get()
    ]);

    const categoryIdToName = new Map<string, string>();
    for (const doc of categoriesSnap.docs) {
      const row = doc.data() as Record<string, unknown>;
      const n = String(row.name ?? "").trim();
      if (n) categoryIdToName.set(doc.id, n);
    }

    const products: MenuProductDoc[] = [];
    for (const doc of productsSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const name = String(d.name ?? "").trim();
      if (name.toLowerCase() === "test") continue;
      const categoryId = String(d.categoryId ?? d.category ?? "").trim();
      const explicit = String(d.categoryName ?? "").trim();
      const fromCollection = categoryIdToName.get(categoryId)?.trim() ?? "";
      const explicitOk = Boolean(explicit) && explicit !== categoryId;
      const categoryName = fromCollection || (explicitOk ? explicit : "") || "Other";
      products.push({
        id: doc.id,
        name,
        price: Number(d.price ?? 0),
        categoryId,
        categoryName,
        description: typeof d.description === "string" ? d.description : undefined,
        available: d.available !== false
      });
    }

    const categories: MenuCategoryDoc[] = categoriesSnap.docs.map((doc) => {
      const d = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        name: String(d.name ?? ""),
        active: d.active !== false,
        sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : undefined
      };
    });

    return Response.json({
      ok: true as const,
      timestamp: new Date().toISOString(),
      firebase: {
        adminSdk: "initialized",
        firestoreRead: "ok"
      },
      counts: {
        productsReturned: products.length,
        categoriesReturned: categories.length
      },
      menu: {
        products,
        categories
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(
      message,
      500,
      "Ensure server env has FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (see backend/firebase/admin.ts). For local dev, add them to customer-web/.env.local."
    );
  }
}

type PostBody = {
  name?: unknown;
  price?: unknown;
  categoryId?: unknown;
  categoryName?: unknown;
  description?: unknown;
  available?: unknown;
};

/**
 * POST — Create one product in Firestore `products` (test write).
 * Auth: header `x-menu-test-secret` or `Authorization: Bearer <MENU_TEST_SECRET>` when MENU_TEST_SECRET is set;
 * in development with no secret, writes are allowed (do not deploy that pattern to production without a secret).
 */
export async function POST(request: Request) {
  if (!authorizeTestWrite(request)) {
    return jsonError(
      "Forbidden: set MENU_TEST_SECRET in env and send x-menu-test-secret (or Authorization: Bearer) to allow test writes.",
      403
    );
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const name = String(body.name ?? "").trim();
  const categoryId = String(body.categoryId ?? "").trim();
  const categoryName = String(body.categoryName ?? "").trim();
  const price = Number(body.price);

  if (!name || !categoryId || !categoryName || !Number.isFinite(price) || price < 0) {
    return jsonError(
      "Validation failed: require name (string), categoryId (string), categoryName (string), price (non-negative number).",
      400
    );
  }

  try {
    const docRef = await adminDb.collection("products").add({
      name,
      categoryId,
      categoryName,
      price,
      description: typeof body.description === "string" ? body.description : "",
      available: body.available !== false,
      rating: 4.5,
      image: "",
      ingredients: [] as string[],
      sizes: [{ label: "Medium", multiplier: 1 }],
      featured: false,
      popular: false
    });

    return Response.json({
      ok: true as const,
      id: docRef.id,
      message: "Product written to Firestore collection `products`.",
      firebase: {
        adminSdk: "initialized",
        firestoreWrite: "ok"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(message, 500);
  }
}
