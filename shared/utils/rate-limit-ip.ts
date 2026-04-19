/**
 * IP-based rate limiting for API routes (in-memory; use Redis/Vercel KV for multi-instance production if needed).
 */
export { consumeRateLimit } from "./api-security";
export { getClientIpFromRequest } from "./client-ip";
