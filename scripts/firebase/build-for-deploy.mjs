#!/usr/bin/env node
/**
 * Build apps for Firebase deployment in required order.
 * Usage: node build-for-deploy.mjs [customer|admin|functions|all]
 */
import { execSync } from "child_process";
import path from "path";
import { detectAppFramework } from "./detect-app-framework.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const target = (process.argv[2] || "all").toLowerCase();

function run(label, command) {
  console.log(`\n▶ ${label}\n   ${command}\n`);
  execSync(command, { cwd: repoRoot, stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
}

function buildApp(appName, workspaceName) {
  const appDir = path.join(repoRoot, appName);
  const detected = detectAppFramework(appDir);
  console.log(`Detected ${appName}: ${detected.framework} (${detected.deployMode})`);
  run(`Build ${appName}`, `npm run build --workspace=${workspaceName}`);
}

function buildFunctions() {
  run("Build Cloud Functions", "npm run build --workspace=@nausheen/functions");
}

const steps = [];

if (target === "customer" || target === "all") {
  steps.push(() => buildApp("customer-web", "@nausheen/customer-web"));
}
if (target === "admin" || target === "all") {
  steps.push(() => buildApp("admin-dashboard", "@nausheen/admin-dashboard"));
}
if (target === "functions" || target === "all") {
  steps.push(buildFunctions);
}

if (!steps.length) {
  console.error("Usage: node build-for-deploy.mjs [customer|admin|functions|all]");
  process.exit(1);
}

console.log(`\nBuild for deploy: ${target}\n`);
for (const step of steps) step();
console.log("\nBuild complete.\n");
