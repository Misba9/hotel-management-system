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

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function checkEnvFiles() {
  for (const app of ["customer-web", "admin-dashboard"]) {
    const prodEnv = path.join(repoRoot, app, ".env.production");
    const localEnv = path.join(repoRoot, app, ".env.local");
    if (!fs.existsSync(prodEnv) && !fs.existsSync(localEnv)) {
      warnings.push(`${app}: no .env.production or .env.local — production build may miss secrets.`);
      continue;
    }

    const env = parseEnvFile(fs.existsSync(localEnv) ? localEnv : prodEnv) || {};
    const authDomain = env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "";
    const projectIdEnv = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
    const senderId = env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "";
    const appId = env.NEXT_PUBLIC_FIREBASE_APP_ID || "";

    if (projectIdEnv && projectIdEnv !== projectId) {
      errors.push(
        `${app}: NEXT_PUBLIC_FIREBASE_PROJECT_ID="${projectIdEnv}" must be "${projectId}" (Google Sign-In / Auth).`
      );
    }
    if (authDomain && !authDomain.endsWith(".firebaseapp.com")) {
      errors.push(
        `${app}: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${authDomain}" must be *.firebaseapp.com ` +
          `(custom brand domains cause Google redirect_uri_mismatch unless Custom Auth Domain is configured).`
      );
    }
    if (authDomain && projectIdEnv && authDomain !== `${projectIdEnv}.firebaseapp.com`) {
      errors.push(
        `${app}: authDomain "${authDomain}" must match projectId → "${projectIdEnv}.firebaseapp.com".`
      );
    }
    const appIdParts = appId.split(":");
    if (appIdParts.length >= 2 && senderId && appIdParts[1] !== senderId) {
      errors.push(
        `${app}: APP_ID project number (${appIdParts[1]}) !== MESSAGING_SENDER_ID (${senderId}).`
      );
    }
    if (authDomain === `${projectId}.firebaseapp.com`) {
      info.push(`${app}: authDomain OK (${authDomain})`);
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
  info.push(`  Add: localhost, 127.0.0.1, ${domains.customer}, www.${domains.customer}, ${domains.admin}`);
  info.push(`  Add: ${projectId}.firebaseapp.com, ${projectId}.web.app`);
  info.push("--- Google Cloud OAuth (Web client) ---");
  info.push("  Authorized JavaScript origins:");
  info.push("    http://localhost:3000");
  info.push("    http://localhost:3001");
  info.push(`    https://${domains.customer}`);
  info.push(`    https://www.${domains.customer}`);
  info.push(`    https://${domains.admin}`);
  info.push(`    https://${projectId}.firebaseapp.com`);
  info.push(`    https://${projectId}.web.app`);
  info.push("  Authorized redirect URIs (required for Google Sign-In):");
  info.push(`    https://${projectId}.firebaseapp.com/__/auth/handler`);
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
