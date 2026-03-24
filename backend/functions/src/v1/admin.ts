import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import {
  COLLECTIONS,
  assertRole,
  auth,
  createTimestamp,
  db,
  paymentStatusSchema,
  userRoleSchema,
  withCallableGuard
} from "./common";

const upsertCategorySchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(2).max(120),
  active: z.boolean().optional()
});

const upsertProductSchema = z.object({
  productId: z.string().min(1).optional(),
  name: z.string().min(2).max(120),
  categoryId: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  available: z.boolean().optional()
});

const upsertStaffSchema = z.object({
  uid: z.string().min(1),
  fullName: z.string().min(2).max(120),
  role: z.enum(["kitchen_staff", "waiter", "cashier", "delivery_boy", "manager"]),
  phone: z.string().min(8).max(20).optional(),
  branchId: z.string().min(1)
});

const orderQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.number().int().positive().max(100).optional()
});

const salesReportSchema = z.object({
  from: z.string().min(10),
  to: z.string().min(10)
});

export const upsertCategoryV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["manager", "admin"]);
    const ref = payload.categoryId
      ? db.collection(COLLECTIONS.categories).doc(payload.categoryId)
      : db.collection(COLLECTIONS.categories).doc();
    const now = createTimestamp();
    await ref.set(
      {
        id: ref.id,
        name: payload.name,
        active: payload.active ?? true,
        updatedAt: now,
        createdAt: now
      },
      { merge: true }
    );
    return { success: true, id: ref.id };
  },
  upsertCategorySchema
);

export const upsertProductV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["manager", "admin"]);
    const categorySnap = await db.collection(COLLECTIONS.categories).doc(payload.categoryId).get();
    if (!categorySnap.exists) {
      throw new HttpsError("not-found", "Category not found.");
    }
    const ref = payload.productId
      ? db.collection(COLLECTIONS.products).doc(payload.productId)
      : db.collection(COLLECTIONS.products).doc();
    const now = createTimestamp();
    await ref.set(
      {
        id: ref.id,
        name: payload.name,
        categoryId: payload.categoryId,
        price: payload.price,
        description: payload.description ?? "",
        imageUrl: payload.imageUrl ?? "",
        available: payload.available ?? true,
        updatedAt: now,
        createdAt: now
      },
      { merge: true }
    );
    return { success: true, id: ref.id };
  },
  upsertProductSchema
);

export const upsertStaffV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["admin"]);
    await auth.setCustomUserClaims(payload.uid, { role: payload.role });
    const now = createTimestamp();
    await db.collection(COLLECTIONS.users).doc(payload.uid).set(
      {
        id: payload.uid,
        fullName: payload.fullName,
        role: payload.role,
        phone: payload.phone ?? null,
        branchId: payload.branchId,
        active: true,
        updatedAt: now,
        createdAt: now
      },
      { merge: true }
    );
    return { success: true };
  },
  upsertStaffSchema
);

export const listOrdersV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["cashier", "kitchen_staff", "manager", "admin"]);
    let query = db.collection(COLLECTIONS.orders).orderBy("createdAt", "desc").limit(payload.limit ?? 20);
    if (payload.status) {
      query = db.collection(COLLECTIONS.orders).where("status", "==", payload.status).orderBy("createdAt", "desc").limit(payload.limit ?? 20);
    }
    const snap = await query.get();
    return {
      success: true,
      items: snap.docs.map((doc) => doc.data())
    };
  },
  orderQuerySchema
);

export const getSalesReportV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["manager", "admin"]);
    const ordersSnap = await db
      .collection(COLLECTIONS.orders)
      .where("createdAt", ">=", payload.from)
      .where("createdAt", "<=", payload.to)
      .get();
    const paymentsSnap = await db
      .collection(COLLECTIONS.payments)
      .where("createdAt", ">=", payload.from)
      .where("createdAt", "<=", payload.to)
      .get();

    const orders = ordersSnap.docs.map((doc) => doc.data() as { total?: number; status?: string; paymentMethod?: string });
    const paidPayments = paymentsSnap.docs
      .map((doc) => doc.data() as { amount?: number; status?: z.infer<typeof paymentStatusSchema> })
      .filter((payment) => payment.status === "paid");

    const totalOrders = orders.length;
    const grossSales = orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const collectedAmount = paidPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const deliveredOrders = orders.filter((order) => order.status === "delivered").length;

    return {
      success: true,
      report: {
        from: payload.from,
        to: payload.to,
        totalOrders,
        deliveredOrders,
        grossSales,
        collectedAmount
      }
    };
  },
  salesReportSchema
);

export const seedSettingsV1 = withCallableGuard(
  async (_payload, ctx) => {
    assertRole(ctx.role, ["admin"]);
    const now = createTimestamp();
    await db.collection(COLLECTIONS.settings).doc("global").set(
      {
        id: "global",
        storeName: "Nausheen Fruits Juice Center",
        currency: "INR",
        timezone: "Asia/Karachi",
        updatedAt: now,
        createdAt: now
      },
      { merge: true }
    );
    const notificationRef = db.collection(COLLECTIONS.notifications).doc();
    await notificationRef.set({
      id: notificationRef.id,
      channel: "system",
      title: "Settings initialized",
      body: "Default settings document is now available.",
      createdAt: now
    });
    return { success: true };
  },
  z.object({})
);

export const createAdminUserV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["admin"]);
    const role = userRoleSchema.parse(payload.role);
    await auth.setCustomUserClaims(payload.uid, { role });
    return { success: true };
  },
  z.object({
    uid: z.string().min(1),
    role: z.enum(["admin", "manager", "cashier", "kitchen_staff", "delivery_boy", "waiter", "customer"])
  })
);
