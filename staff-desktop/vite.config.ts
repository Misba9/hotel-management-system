import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { razorpayPosApiPlugin } from "./vite-plugin-razorpay-api";

const repoRoot = path.resolve(__dirname, "..");
const adminEnvDir = path.join(repoRoot, "admin-dashboard");
/** Must match `DEV_FUNCTIONS_PROXY_PREFIX` in src/lib/cloud-functions-url.ts */
const DEV_FUNCTIONS_PROXY_PREFIX = "/api/cloud-fn";

export default defineConfig(({ mode }) => {
  const adminEnv = loadEnv(mode, adminEnvDir, ["VITE_", "NEXT_PUBLIC_"]);
  const rootEnv = loadEnv(mode, repoRoot, ["VITE_", "NEXT_PUBLIC_"]);
  const mergedEnv = { ...adminEnv, ...rootEnv };

  const projectId =
    mergedEnv.VITE_FIREBASE_PROJECT_ID ??
    mergedEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    "nausheen-fruits-new";
  const cloudFunctionsTarget = `https://us-central1-${projectId}.cloudfunctions.net`;

  return {
    envDir: repoRoot,
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: Object.fromEntries(
      Object.entries(mergedEnv)
        .filter(([key]) => key.startsWith("VITE_") || key.startsWith("NEXT_PUBLIC_"))
        .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
    ),
    plugins: [react(), razorpayPosApiPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@shared": path.resolve(repoRoot, "shared")
      }
    },
    build: { outDir: "dist" },
    server: {
      port: 5177,
      strictPort: true,
      proxy: {
        [DEV_FUNCTIONS_PROXY_PREFIX]: {
          target: cloudFunctionsTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (requestPath) => requestPath.replace(new RegExp(`^${DEV_FUNCTIONS_PROXY_PREFIX}`), "")
        }
      }
    }
  };
});
