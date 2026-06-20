import express from "express";
import {onRequest} from "firebase-functions/v2/https";
import {mapSwiggyPayload, mapZomatoPayload, persistPlatformOrder} from "../platform-order.js";

function verifySecret(
  req: express.Request,
  envKey: "ZOMATO_WEBHOOK_SECRET" | "SWIGGY_WEBHOOK_SECRET",
  headerNames: string[]
): boolean {
  const secret = process.env[envKey]?.trim();
  if (!secret) return true;
  const header = headerNames
    .map((name) => req.headers[name])
    .find((value) => typeof value === "string");
  return header === secret;
}

async function processZomatoWebhook(
  req: express.Request,
  res: express.Response
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  if (!verifySecret(req, "ZOMATO_WEBHOOK_SECRET", ["x-zomato-signature", "x-webhook-secret"])) {
    res.status(401).json({error: "Unauthorized"});
    return;
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const eventType = String(body.event ?? body.event_type ?? body.type ?? "order.created")
      .toLowerCase();
    if (eventType.includes("cancel")) {
      res.status(200).json({ok: true, ignored: true});
      return;
    }

    const order = mapZomatoPayload(body);
    if (!order.items.length) {
      res.status(400).json({error: "Order has no line items"});
      return;
    }

    await persistPlatformOrder(order);
    res.status(200).json({ok: true, orderId: order.id, orderNumber: order.orderNumber});
  } catch (error) {
    console.error("[zomato-webhook] failed", error);
    res.status(500).json({error: "Failed to process Zomato webhook"});
  }
}

async function processSwiggyWebhook(
  req: express.Request,
  res: express.Response
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  if (!verifySecret(req, "SWIGGY_WEBHOOK_SECRET", ["x-swiggy-signature", "x-webhook-secret"])) {
    res.status(401).json({error: "Unauthorized"});
    return;
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const eventType = String(body.event ?? body.eventType ?? body.type ?? "order.created")
      .toLowerCase();
    if (eventType.includes("cancel")) {
      res.status(200).json({ok: true, ignored: true});
      return;
    }

    const order = mapSwiggyPayload(body);
    if (!order.items.length) {
      res.status(400).json({error: "Order has no line items"});
      return;
    }

    await persistPlatformOrder(order);
    res.status(200).json({ok: true, orderId: order.id, orderNumber: order.orderNumber});
  } catch (error) {
    console.error("[swiggy-webhook] failed", error);
    res.status(500).json({error: "Failed to process Swiggy webhook"});
  }
}

const app = express();
app.use(express.json());
app.post("/webhook/zomato", (req, res) => {
  void processZomatoWebhook(req, res);
});
app.post("/webhook/swiggy", (req, res) => {
  void processSwiggyWebhook(req, res);
});

export const platformWebhooks = onRequest({cors: false, maxInstances: 20}, app);

export const handleZomatoWebhook = onRequest({cors: false, maxInstances: 20}, (req, res) => {
  void processZomatoWebhook(req as express.Request, res as express.Response);
});

export const handleSwiggyWebhook = onRequest({cors: false, maxInstances: 20}, (req, res) => {
  void processSwiggyWebhook(req as express.Request, res as express.Response);
});
