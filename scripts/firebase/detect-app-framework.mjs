#!/usr/bin/env node
/**
 * Detect web app framework from package.json dependencies.
 * Supports: nextjs | vite | cra | static
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export function detectAppFramework(appDir) {
  const pkgPath = path.join(appDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`Missing package.json: ${appDir}`);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps.next) {
    return {
      framework: "nextjs",
      deployMode: "ssr",
      buildCommand: "npm run build",
      outputDir: ".next",
      hostingSource: true,
      notes: "Next.js App Router with API routes — use Firebase framework-aware hosting (SSR via Cloud Run)."
    };
  }

  if (deps.vite) {
    return {
      framework: "vite",
      deployMode: "spa",
      buildCommand: "npm run build",
      outputDir: "dist",
      hostingSource: false,
      notes: "Vite SPA — static export to dist/ with SPA rewrites."
    };
  }

  if (deps["react-scripts"]) {
    return {
      framework: "cra",
      deployMode: "spa",
      buildCommand: "npm run build",
      outputDir: "build",
      hostingSource: false,
      notes: "Create React App — static export to build/ with SPA rewrites."
    };
  }

  return {
    framework: "static",
    deployMode: "static",
    buildCommand: null,
    outputDir: "public",
    hostingSource: false,
    notes: "Unknown framework — configure hosting public directory manually."
  };
}

function main() {
  const appName = process.argv[2];
  if (!appName) {
    console.error("Usage: node detect-app-framework.mjs <customer-web|admin-dashboard>");
    process.exit(1);
  }

  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const appDir = path.join(repoRoot, appName);
  const result = detectAppFramework(appDir);
  console.log(JSON.stringify({ app: appName, appDir, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
