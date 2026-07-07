#!/usr/bin/env node
/**
 * Validate Firebase deployment configuration before deploy.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { detectAppFramework } from "./detect-app-framework.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const projectId = "nausheen-fruits-new";
const domains = {
  customer: "nausheenfruitjuicecenter.com",
  admin: "admin.nausheenfruitjuicecenter.com"
};

const errors = [];
const warnings = [];
const info = [];

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function readJson(relPath) {
  const full = path.join(repoRoot, relPath);
  if (!fs.existsSync(full)) {
    errors.push(`Missing file: ${relPath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    errors.push(`Invalid JSON in ${relPath}: ${error.message}`);
    return null;
  }
}

function checkFirebaseCli() {
  const commands = ["firebase --version", "npx firebase --version"];
  for (const cmd of commands) {
    try {
      const version = execSync(cmd, { encoding: "utf8", cwd: repoRoot }).trim();
      info.push(`Firebase CLI: ${version} (${cmd.split(" ")[0]})`);
      const major = Number.parseInt(version.split(".")[0], 10);
      if (Number.isFinite(major) && major < 13) {
        warnings.push("Firebase CLI >= 13 recommended for Next.js framework hosting.");
      }
      return;
    } catch {
      /* try next */
    }
  }
  errors.push("Firebase CLI not found. Run: npm install && npx firebase --version");
}

function checkWebFrameworksExperiment() {
  try {
    const out = execSync("npx firebase experiments:list", { encoding: "utf8", cwd: repoRoot });
    const line = out.split("\n").find((row) => row.includes("webframeworks"));
    if (line && /│\s*y\s*│/.test(line)) {
      info.push("Firebase webframeworks experiment: enabled");
      return;
    }
    warnings.push(
      'webframeworks experiment not enabled. Run: npm run firebase:enable-webframeworks (or deploy scripts enable it automatically).'
    );
  } catch {
    warnings.push("Could not read Firebase experiments list.");
  }
}

function checkFirebaserc(firebaserc) {
  if (!firebaserc) return;
  if (firebaserc.projects?.default !== projectId) {
    errors.push(`.firebaserc default project must be "${projectId}".`);
  }
  const targets = firebaserc.targets?.[projectId]?.hosting;
  if (!targets?.customer?.length) {
    errors.push(`.firebaserc missing hosting target mapping for "customer".`);
  }
  if (!targets?.admin?.length) {
    errors.push(`.firebaserc missing hosting target mapping for "admin".`);
  }
  if (targets?.customer?.[0]) {
    info.push(`Customer hosting site ID: ${targets.customer[0]}`);
  }
  if (targets?.admin?.[0]) {
    info.push(`Admin hosting site ID: ${targets.admin[0]}`);
  }
}

function checkFirebaseJson(firebaseJson) {
  if (!firebaseJson) return;

  if (firebaseJson.functions?.source !== "backend/functions") {
    warnings.push('functions.source should be "backend/functions" to preserve existing Cloud Functions.');
  }
  if (!exists("backend/firestore.rules")) {
    errors.push("Missing backend/firestore.rules");
  }
  if (!exists("backend/firestore.indexes.json")) {
    errors.push("Missing backend/firestore.indexes.json");
  }
  if (!exists("backend/storage.rules")) {
    errors.push("Missing backend/storage.rules");
  }
  if (!exists("backend/functions/package.json")) {
    errors.push("Missing backend/functions/package.json");
  }

  const hosting = firebaseJson.hosting;
  if (!Array.isArray(hosting) || hosting.length < 2) {
    errors.push("firebase.json must define hosting targets: customer and admin.");
    return;
  }

  for (const target of ["customer", "admin"]) {
    const entry = hosting.find((h) => h.target === target);
    if (!entry) {
      errors.push(`firebase.json missing hosting target "${target}".`);
      continue;
    }

    const appDir = entry.source;
    if (!appDir || !exists(appDir)) {
      errors.push(`Hosting target "${target}" source "${appDir}" not found.`);
      continue;
    }

    const detected = detectAppFramework(path.join(repoRoot, appDir));
    info.push(`${target}: ${detected.framework} (${detected.deployMode}) from ${appDir}/`);

    if (detected.framework === "nextjs") {
      if (entry.public && !entry.source) {
        warnings.push(`Target "${target}" uses static "public" — Next.js with API routes needs "source" for SSR.`);
      }
      if (!entry.frameworksBackend?.region) {
        warnings.push(`Target "${target}" missing frameworksBackend.region (recommended: asia-south1).`);
      }
    }

    if ((detected.framework === "vite" || detected.framework === "cra") && !entry.public) {
      warnings.push(`Target "${target}" is SPA but firebase.json has no "public" directory.`);
    }

    const security = entry.headers?.find((h) => h.source === "**");
    if (!security) {
      warnings.push(`Target "${target}" missing global security headers.`);
    }
  }
}

function checkEnvFiles() {
  for (const app of ["customer-web", "admin-dashboard"]) {
    const prodEnv = path.join(repoRoot, app, ".env.production");
    const localEnv = path.join(repoRoot, app, ".env.local");
    if (!fs.existsSync(prodEnv) && !fs.existsSync(localEnv)) {
      warnings.push(`${app}: no .env.production or .env.local — production build may miss secrets.`);
    }
  }

  const fnEnv = path.join(repoRoot, "backend/functions/.env");
  if (!fs.existsSync(fnEnv)) {
    warnings.push("backend/functions/.env not found — set Cloud Functions env in Firebase Console or .env.");
  }
}

function printDnsGuide() {
  info.push("--- GoDaddy DNS (after Firebase domain verification) ---");
  info.push(`Customer apex ${domains.customer}:`);
  info.push("  1) Add domain in Firebase Console → Hosting → customer site → Add custom domain");
  info.push("  2) Add TXT record GoDaddy gives you for verification");
  info.push("  3) Add A records Firebase provides (typically 199.36.158.100 and backup IPs from console)");
  info.push(`Admin ${domains.admin}:`);
  info.push("  1) Add subdomain in Firebase Console → Hosting → admin site");
  info.push("  2) CNAME admin → ghs.googlehosted.com OR site-specific target from Firebase Console");
  info.push("  3) SSL certificates are provisioned automatically by Firebase (allow up to 24h)");
  info.push("--- Firebase Auth authorized domains ---");
  info.push(`  Add: ${domains.customer}, www.${domains.customer}, ${domains.admin}`);
}

function main() {
  console.log(`\nFirebase deploy validation — project: ${projectId}\n`);

  checkFirebaseCli();
  checkWebFrameworksExperiment();
  checkFirebaserc(readJson(".firebaserc"));
  checkFirebaseJson(readJson("firebase.json"));
  checkEnvFiles();
  printDnsGuide();

  if (info.length) {
    console.log("Info:");
    for (const line of info) console.log(`  • ${line}`);
    console.log("");
  }

  if (warnings.length) {
    console.log("Warnings:");
    for (const line of warnings) console.log(`  ⚠ ${line}`);
    console.log("");
  }

  if (errors.length) {
    console.error("Errors:");
    for (const line of errors) console.error(`  ✗ ${line}`);
    console.error(`\nValidation failed with ${errors.length} error(s).\n`);
    process.exit(1);
  }

  console.log("Validation passed.\n");
}

main();
