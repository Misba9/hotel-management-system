import { onRequest } from "firebase-functions/v2/https";

export const healthCheck = onRequest((_, res) => {
  res.status(200).json({
    ok: true,
    service: "nausheen-fruits-functions",
    timestamp: new Date().toISOString()
  });
});
