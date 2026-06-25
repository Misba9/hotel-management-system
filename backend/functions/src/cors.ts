/**
 * Browser-allowed origins for HTTP + callable Cloud Functions.
 * `true` reflects the request Origin (required for staff-desktop Vite dev, admin, customer web).
 */
export const httpCorsOptions = {
  cors: true,
  invoker: "public" as const
};

export const callableCorsOptions = {
  cors: true
};
