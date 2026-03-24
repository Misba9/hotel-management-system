import { z } from "zod";
import { COLLECTIONS, assertRole, auth, createTimestamp, db, logInfo, userRoleSchema, withCallableGuard } from "./common";

const completeLoginSchema = z.object({
  panel: z.enum(["customer", "staff", "admin"])
});

const bootstrapProfileSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(8).max(20).optional(),
  role: userRoleSchema.optional()
});

const setUserRoleSchema = z.object({
  uid: z.string().min(1),
  role: userRoleSchema
});

const emailSchema = z.object({
  email: z.string().email(),
  continueUrl: z.string().url().optional()
});

const verifyOtpSchema = z.object({
  phone: z.string().min(8).max(20).optional()
});

export const completeLogin = withCallableGuard(
  async (payload, ctx) => {
    const panelToRoles = {
      customer: ["customer"],
      staff: ["kitchen_staff", "waiter", "cashier", "delivery_boy", "manager"],
      admin: ["admin"]
    } as const;
    const allowed = panelToRoles[payload.panel];
    assertRole(ctx.role, [...allowed]);
    logInfo("Login completed", { uid: ctx.uid, panel: payload.panel, role: ctx.role });
    return {
      success: true,
      user: {
        uid: ctx.uid,
        role: ctx.role
      }
    };
  },
  completeLoginSchema
);

export const bootstrapUserProfile = withCallableGuard(
  async (payload, ctx) => {
    const now = createTimestamp();
    const role = payload.role ?? "customer";
    if (role !== "customer") {
      assertRole(ctx.role, ["admin"]);
    }
    await db.collection(COLLECTIONS.users).doc(ctx.uid).set(
      {
        id: ctx.uid,
        fullName: payload.fullName,
        phone: payload.phone ?? null,
        role,
        updatedAt: now,
        createdAt: now
      },
      { merge: true }
    );
    if (role !== "customer") {
      await auth.setCustomUserClaims(ctx.uid, { role });
    }
    return { success: true, uid: ctx.uid, role };
  },
  bootstrapProfileSchema
);

export const setUserRoleByAdmin = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["admin"]);
    await auth.setCustomUserClaims(payload.uid, { role: payload.role });
    await db.collection(COLLECTIONS.users).doc(payload.uid).set(
      {
        id: payload.uid,
        role: payload.role,
        updatedAt: createTimestamp()
      },
      { merge: true }
    );
    return { success: true };
  },
  setUserRoleSchema
);

export const generateEmailVerificationLink = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["customer", "kitchen_staff", "waiter", "cashier", "delivery_boy", "manager", "admin"]);
    const link = await auth.generateEmailVerificationLink(payload.email, payload.continueUrl ? { url: payload.continueUrl } : undefined);
    return { success: true, link };
  },
  emailSchema
);

export const generatePasswordResetLink = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["customer", "kitchen_staff", "waiter", "cashier", "delivery_boy", "manager", "admin"]);
    const link = await auth.generatePasswordResetLink(payload.email, payload.continueUrl ? { url: payload.continueUrl } : undefined);
    return { success: true, link };
  },
  emailSchema
);

export const verifyOtpLogin = withCallableGuard(
  async (payload, ctx) => {
    const user = await auth.getUser(ctx.uid);
    const hasPhoneProvider = user.providerData.some((provider) => provider.providerId === "phone");
    if (!hasPhoneProvider) {
      return {
        success: false,
        message: "User is not authenticated with phone provider."
      };
    }
    if (payload.phone && user.phoneNumber && payload.phone !== user.phoneNumber) {
      return {
        success: false,
        message: "Provided phone number does not match authenticated user."
      };
    }
    return {
      success: true,
      uid: ctx.uid,
      phone: user.phoneNumber ?? null
    };
  },
  verifyOtpSchema
);
