#!/usr/bin/env node
/**
 * Ensure Artifact Registry cleanup policy for SSR/Cloud Run function images (asia-south1).
 * Prevents deploy failure: "could not set up cleanup policy in location asia-south1".
 */
import { execSync } from "child_process";
import path from "path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const projectId = "nausheen-fruits-new";
const region = "asia-south1";
const retentionDays = 7;

function run(cmd) {
  execSync(cmd, { cwd: repoRoot, stdio: "inherit" });
}

try {
  console.log(`Setting functions artifact cleanup policy (${region}, keep ${retentionDays} days)...`);
  run(
    `npx firebase functions:artifacts:setpolicy --project ${projectId} --location ${region} --days ${retentionDays} --force`
  );
  console.log("Functions artifact cleanup policy: OK");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn("Could not set artifact cleanup policy (deploy may still work with --force):");
  console.warn(message);
}
