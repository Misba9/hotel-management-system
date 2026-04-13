import nextEnv from "@next/env";
import path from "path";
import { fileURLToPath } from "url";

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
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
      "as1.ftcdn.net",
      "firebasestorage.googleapis.com",
      "lh3.googleusercontent.com",
      "storage.googleapis.com",
      "googleusercontent.com"
    ],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "plus.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "as1.ftcdn.net", pathname: "/**" },
      { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
      { protocol: "https", hostname: "**.firebasestorage.app", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "*.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/**" },
      { protocol: "https", hostname: "**.googleapis.com", pathname: "/**" },
      { protocol: "https", hostname: "i.imgur.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.pixabay.com", pathname: "/**" },
      { protocol: "https", hostname: "placehold.co", pathname: "/**" }
    ]
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"]
  }
};

export default nextConfig;
