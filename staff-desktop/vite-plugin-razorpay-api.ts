import path from "node:path";
import { config as loadDotenv } from "dotenv";
import type { Plugin } from "vite";
import {
  RAZORPAY_POS_API_PREFIX,
  handleRazorpayPosHttpRequest
} from "./server/razorpay-pos-api";

/** Vite dev server — local Razorpay API (secrets stay server-side). */
export function razorpayPosApiPlugin(): Plugin {
  const repoRoot = path.resolve(__dirname, "..");
  const adminEnvDir = path.join(repoRoot, "admin-dashboard");

  loadDotenv({ path: path.join(adminEnvDir, ".env.local") });
  loadDotenv({ path: path.join(adminEnvDir, ".env") });
  loadDotenv({ path: path.join(repoRoot, ".env.local") });
  loadDotenv({ path: path.join(repoRoot, ".env") });

  return {
    name: "razorpay-pos-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith(RAZORPAY_POS_API_PREFIX)) {
          next();
          return;
        }
        void handleRazorpayPosHttpRequest(req, res, process.env);
      });
    }
  };
}
