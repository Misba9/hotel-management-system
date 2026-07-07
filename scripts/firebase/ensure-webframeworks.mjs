#!/usr/bin/env node
/**
 * Ensure Firebase CLI webframeworks experiment is enabled (required for Next.js SSR hosting).
 */
import { execSync } from "child_process";
import path from "path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function run(cmd) {
  return execSync(cmd, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function webFrameworksEnabled(output) {
  const line = output.split("\n").find((row) => row.includes("webframeworks"));
  return Boolean(line && /│\s*y\s*│/.test(line));
}

function enable() {
  run("npx firebase experiments:enable webframeworks");
}

try {
  const out = run("npx firebase experiments:list");
  if (webFrameworksEnabled(out)) {
    console.log("Firebase webframeworks experiment: already enabled");
    process.exit(0);
  }

  console.log("Enabling Firebase webframeworks experiment (required for Next.js hosting)...");
  enable();
  console.log("Firebase webframeworks experiment: enabled");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to enable webframeworks experiment.");
  console.error(message);
  console.error("\nRun manually from repo root:");
  console.error("  npx firebase experiments:enable webframeworks");
  process.exit(1);
}
