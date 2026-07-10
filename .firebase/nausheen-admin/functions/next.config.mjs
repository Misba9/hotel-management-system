// ../admin-dashboard/next.config.mjs
import nextEnv from "@next/env";
import path from "path";
import { fileURLToPath } from "url";
var { loadEnvConfig } = nextEnv;
var __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(__dirname);
if (process.env.NODE_ENV !== "production") {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  console.log(
    "[admin-dashboard] NEXT_PUBLIC_FIREBASE_API_KEY:",
    apiKey === void 0 ? "undefined (check admin-dashboard/.env.local and restart dev)" : `set (length=${apiKey.length})`
  );
}
var nextConfig = {
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" }
        ]
      }
    ];
  },
  images: {
    domains: [
      "images.unsplash.com",
      "plus.unsplash.com",
      "images.pexels.com",
      "lovefoodhatewaste.com",
      "www.lovefoodhatewaste.com",
      "firebasestorage.googleapis.com"
    ],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "plus.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
      { protocol: "https", hostname: "lovefoodhatewaste.com", pathname: "/**" },
      { protocol: "https", hostname: "www.lovefoodhatewaste.com", pathname: "/**" }
    ]
  },
  experimental: {
    externalDir: true,
    optimizePackageImports: ["lucide-react", "recharts"],
    /** Keep a single firebase-admin instance in the Node server bundle (Firebase Hosting SSR). */
    serverComponentsExternalPackages: ["firebase-admin"]
  }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
