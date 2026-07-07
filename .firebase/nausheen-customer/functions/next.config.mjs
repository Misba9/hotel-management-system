// customer-web/next.config.mjs
import nextEnv from "@next/env";
import path from "path";
import { fileURLToPath } from "url";
var { loadEnvConfig } = nextEnv;
var __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(__dirname);
var nextConfig = {
  reactStrictMode: true,
  /** Default is true; explicit for font CSS inlining / optimization (see `next/font`). */
  optimizeFonts: true,
  images: {
    domains: [
      "images.unsplash.com",
      "plus.unsplash.com",
      "images.pexels.com",
      "as1.ftcdn.net",
      "firebasestorage.googleapis.com",
      "lh3.googleusercontent.com",
      "storage.googleapis.com",
      "googleusercontent.com",
      "lovefoodhatewaste.com",
      "www.lovefoodhatewaste.com"
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
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      { protocol: "https", hostname: "lovefoodhatewaste.com", pathname: "/**" },
      { protocol: "https", hostname: "www.lovefoodhatewaste.com", pathname: "/**" }
    ]
  }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
