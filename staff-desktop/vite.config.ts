import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = path.resolve(__dirname, "..");
const adminEnvDir = path.join(repoRoot, "admin-dashboard");

export default defineConfig(({ mode }) => {
  const adminEnv = loadEnv(mode, adminEnvDir, ["VITE_", "NEXT_PUBLIC_"]);
  const rootEnv = loadEnv(mode, repoRoot, ["VITE_", "NEXT_PUBLIC_"]);
  const mergedEnv = { ...adminEnv, ...rootEnv };

  return {
    envDir: repoRoot,
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: Object.fromEntries(
      Object.entries(mergedEnv)
        .filter(([key]) => key.startsWith("VITE_") || key.startsWith("NEXT_PUBLIC_"))
        .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
    ),
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@shared": path.resolve(repoRoot, "shared")
      }
    },
    build: { outDir: "dist" },
    server: {
      port: 5177,
      strictPort: true
    }
  };
});
