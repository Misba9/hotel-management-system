import { adminAuth } from "../firebase/admin";
import { logServerInfo } from "../utils/monitoring";
import type { DecodedIdToken } from "firebase-admin/auth";

type Role =
  | "customer"
  | "delivery_boy"
  | "kitchen_staff"
  | "waiter"
  | "cashier"
  | "manager"
  | "admin";

type SecurityOptions = {
  roles?: Role[];
  rateLimit?: {
    keyPrefix: string;
    limit: number;
    windowMs: number;
  };
};

type SecuritySuccess = {
  ok: true;
  uid: string;
  role: Role;
};

type SecurityFailure = {
  ok: false;
  response: Response;
};

const inMemoryRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function enforceApiSecurity(
  request: Request,
  options: SecurityOptions = {},
): Promise<SecuritySuccess | SecurityFailure> {
  if (options.rateLimit) {
    const limited = applyRateLimit(request, options.rateLimit);
    if (limited) {
      logServerInfo("Rate limit blocked", {
        endpoint: options.rateLimit.keyPrefix,
      });
      return {
        ok: false,
        response: Response.json(
          { error: "Too many requests. Please try again shortly." },
          { status: 429 },
        ),
      };
    }
  }

  if (!options.roles || options.roles.length === 0) {
    return { ok: true, uid: "anonymous", role: "customer" };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    logServerInfo("Missing bearer token", {
      endpoint: options.roles.join(","),
    });
    return {
      ok: false,
      response: Response.json(
        { error: "Missing bearer token." },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    logServerInfo("Invalid bearer token", {
      endpoint: options.roles.join(","),
    });
    return {
      ok: false,
      response: Response.json(
        { error: "Invalid bearer token." },
        { status: 401 },
      ),
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const role = extractRole(decoded);
    if (!options.roles.includes(role)) {
      logServerInfo("Permission denied", {
        role,
        requiredRoles: options.roles,
      });
      return {
        ok: false,
        response: Response.json(
          { error: "Forbidden: admin role required." },
          { status: 403 },
        ),
      };
    }
    return {
      ok: true,
      uid: decoded.uid,
      role,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Token verification failed:", error);
    }
    return {
      ok: false,
      response: Response.json(
        { error: "Unauthorized: invalid or expired token." },
        { status: 401 },
      ),
    };
  }
}

function extractRole(decoded: DecodedIdToken): Role {
  const roleCandidate = decoded.role;
  if (isRole(roleCandidate)) {
    return roleCandidate;
  }
  return "customer";
}

function isRole(value: unknown): value is Role {
  return (
    value === "customer" ||
    value === "delivery_boy" ||
    value === "kitchen_staff" ||
    value === "waiter" ||
    value === "cashier" ||
    value === "manager" ||
    value === "admin"
  );
}

function applyRateLimit(
  request: Request,
  config: {
    keyPrefix: string;
    limit: number;
    windowMs: number;
  },
) {
  const key = `${config.keyPrefix}:${extractClientIp(request)}`;
  const now = Date.now();
  const current = inMemoryRateLimit.get(key);
  if (!current || now >= current.resetAt) {
    inMemoryRateLimit.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return false;
  }
  if (current.count >= config.limit) {
    return true;
  }
  inMemoryRateLimit.set(key, {
    count: current.count + 1,
    resetAt: current.resetAt,
  });
  return false;
}

function extractClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
