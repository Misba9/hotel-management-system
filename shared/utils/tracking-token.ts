import crypto from "node:crypto";

type TrackingTokenPayload = {
  tid: string;
  exp: number;
};

const DEFAULT_TRACKING_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;

function getTrackingSecret(): string {
  const secret = process.env.TRACKING_TOKEN_SECRET ?? process.env.FIREBASE_PRIVATE_KEY ?? "";
  if (!secret) {
    throw new Error("TRACKING_TOKEN_SECRET is not configured.");
  }
  return secret;
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function generateSignedTrackingToken(
  trackingId: string,
  ttlSeconds = DEFAULT_TRACKING_TOKEN_TTL_SECONDS
): string {
  const payload: TrackingTokenPayload = {
    tid: trackingId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, getTrackingSecret());
  return `${encodedPayload}.${signature}`;
}

export function verifySignedTrackingToken(token: string, trackingId: string): boolean {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  let payload: TrackingTokenPayload;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as TrackingTokenPayload;
  } catch {
    return false;
  }

  if (payload.tid !== trackingId) return false;
  if (payload.exp < Math.floor(Date.now() / 1000)) return false;

  try {
    const expectedSignature = signPayload(encodedPayload, getTrackingSecret());
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}
