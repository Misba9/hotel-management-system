#!/usr/bin/env node
/**
 * Deploy to Firebase (nausheen-fruits-new).
 * Usage: node deploy.mjs [customer|admin|all]
 *
 * Build order (all):
 *   customer-web → admin-dashboard → functions → hosting
 */
import { execSync } from "child_process";
import path from "path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const target = (process.argv[2] || "all").toLowerCase();
const projectId = "nausheen-fruits-new";
const firebaseConfig = path.join(repoRoot, "firebase.json");

function run(command, options = {}) {
  console.log(`\n▶ ${command}\n`);
  execSync(command, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
    ...options
  });
}

const firebaseDeployFlags = "--non-interactive --force";

function validate() {
  run(`node scripts/firebase/ensure-webframeworks.mjs`);
  run(`node scripts/firebase/ensure-artifacts-policy.mjs`);
  run(`node scripts/firebase/validate-config.mjs`);
}

function deployCustomer() {
  run("node scripts/firebase/build-for-deploy.mjs customer");
  run(
    `npx firebase deploy --project ${projectId} --config "${firebaseConfig}" --only hosting:customer ${firebaseDeployFlags}`
  );
}

function deployAdmin() {
  run("node scripts/firebase/build-for-deploy.mjs admin");
  run(
    `npx firebase deploy --project ${projectId} --config "${firebaseConfig}" --only hosting:admin ${firebaseDeployFlags}`
  );
}

function deployAll() {
  run("node scripts/firebase/build-for-deploy.mjs all");
  run(
    `npx firebase deploy --project ${projectId} --config "${firebaseConfig}" --only functions,hosting:customer,hosting:admin ${firebaseDeployFlags}`
  );
}

function verify() {
  console.log("\n▶ Post-deploy verification\n");
  const sites = {
    customer: "https://nausheenfruitjuicecenter.com",
    admin: "https://admin.nausheenfruitjuicecenter.com"
  };

  for (const [name, url] of Object.entries(sites)) {
    try {
      execSync(`curl -sI "${url}" | head -n 5`, { stdio: "inherit" });
      console.log(`  ✓ ${name}: ${url} responded\n`);
    } catch {
      console.log(`  ⚠ ${name}: ${url} not reachable yet (DNS/SSL may still be propagating)\n`);
    }
  }

  console.log("Manual checks:");
  console.log("  • Firebase Console → Authentication → Authorized domains");
  console.log("  • Firebase Console → Firestore → Rules deployed");
  console.log("  • Firebase Console → Storage → Rules deployed");
  console.log("  • Firebase Console → Functions → All functions active");
  console.log("  • Customer login + checkout on production domain");
  console.log("  • Admin login on admin subdomain\n");
}

validate();

switch (target) {
  case "customer":
    deployCustomer();
    break;
  case "admin":
    deployAdmin();
    break;
  case "all":
    deployAll();
    break;
  default:
    console.error("Usage: node deploy.mjs [customer|admin|all]");
    process.exit(1);
}

verify();
