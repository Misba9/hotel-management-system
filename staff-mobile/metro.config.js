/**
 * Staff mobile (monorepo):
 * - Prefer `staff-mobile/node_modules`, then repo root (npm hoists many packages there).
 * - Watch only this app + `shared/` — do not watch admin-dashboard / customer-web (avoids wrong Metro graph).
 * - `@shared/*` → source files under `../shared`.
 */
const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");
const metroResolver = require("metro-resolver");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const sharedRoot = path.join(workspaceRoot, "shared");
const localNodeModules = path.join(projectRoot, "node_modules");
const rootNodeModules = path.join(workspaceRoot, "node_modules");

function resolvePackageDir(packageName, preferLocalOnly = false) {
  const bases = preferLocalOnly ? [projectRoot] : [projectRoot, workspaceRoot];
  for (const base of bases) {
    try {
      return path.dirname(require.resolve(`${packageName}/package.json`, { paths: [base] }));
    } catch {
      /* try next */
    }
  }
  throw new Error(`[staff-mobile metro] Could not resolve package: ${packageName}`);
}

function resolveVirtualizedListsDir() {
  try {
    return resolvePackageDir("@react-native/virtualized-lists");
  } catch {
    const nested = path.join(
      resolvePackageDir("react-native"),
      "node_modules",
      "@react-native",
      "virtualized-lists"
    );
    if (fs.existsSync(path.join(nested, "package.json"))) {
      return nested;
    }
    throw new Error(
      "Could not resolve @react-native/virtualized-lists (expected under react-native/node_modules)."
    );
  }
}

function resolveAtAlias(moduleName, projectRoot) {
  const norm = String(moduleName || "").replace(/\\/g, "/");
  if (!norm.startsWith("@/")) return null;
  const rel = norm.slice(2);
  const base = path.join(projectRoot, rel);
  const suffixes = [".tsx", ".ts", ".jsx", ".js"];
  for (const ext of suffixes) {
    const fp = base + ext;
    if (fs.existsSync(fp)) return fp;
  }
  for (const ext of suffixes) {
    const fp = path.join(projectRoot, rel, `index${ext}`);
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

function resolveSharedSource(moduleName) {
  if (!moduleName.startsWith("@shared/")) return null;
  const rel = moduleName.slice("@shared/".length);
  const base = path.join(sharedRoot, rel);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js")
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(projectRoot), sharedRoot, rootNodeModules];

config.resolver.nodeModulesPaths = [localNodeModules, rootNodeModules];

// Monorepo: resolve hoisted deps only via nodeModulesPaths (not nested per-package lookups).
config.resolver.disableHierarchicalLookup = true;

/** Use the @firebase/auth copy bundled with `firebase` (avoids hoisted 1.13.x vs firebase 10.x mismatch). */
function resolveFirebaseNestedAuthDir() {
  const firebaseDir = resolvePackageDir("firebase", true);
  const nested = path.join(firebaseDir, "node_modules", "@firebase", "auth");
  if (fs.existsSync(path.join(nested, "package.json"))) {
    return nested;
  }
  return resolvePackageDir("@firebase/auth");
}

function resolveFirebaseAuthRnEntry() {
  return path.join(resolveFirebaseNestedAuthDir(), "dist", "rn", "index.js");
}

const firebaseAuthRnEntry = resolveFirebaseAuthRnEntry();

const deduped = {
  // RN 0.74 expects react@18.2 — never fall back to hoisted root 18.3.x (invalid hook call).
  react: resolvePackageDir("react", true),
  "react-dom": resolvePackageDir("react-dom", true),
  "@react-native/virtualized-lists": resolveVirtualizedListsDir()
};
try {
  deduped.scheduler = resolvePackageDir("scheduler");
} catch {
  /* optional */
}
/** Hoisted workspaces: `expo-router` may live only under repo root — map it so Metro never 404s the web entry. */
try {
  deduped["expo-router"] = resolvePackageDir("expo-router");
} catch {
  /* optional */
}
/** Workspace hoist: `expo-notifications` may live only under repo root (avoids lazy-split 404 under staff-mobile). */
try {
  deduped["expo-notifications"] = resolvePackageDir("expo-notifications");
} catch {
  /* optional */
}
/** Single Firestore SDK for staff-mobile + `@shared` hooks (prevents collection() type errors on web). */
try {
  deduped["@firebase/auth"] = resolveFirebaseNestedAuthDir();
} catch {
  /* optional */
}
try {
  deduped["@firebase/app"] = resolvePackageDir("@firebase/app", true);
} catch {
  /* optional */
}
try {
  deduped["@firebase/firestore"] = resolvePackageDir("@firebase/firestore", true);
} catch {
  /* optional */
}
try {
  deduped.firebase = resolvePackageDir("firebase", true);
} catch {
  /* optional */
}
try {
  deduped["@expo/metro-runtime"] = resolvePackageDir("@expo/metro-runtime");
} catch {
  /* optional */
}
try {
  deduped.zustand = resolvePackageDir("zustand");
} catch {
  /* optional */
}

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...deduped
};

const upstreamResolveRequest = config.resolver.resolveRequest;

function resolveWithoutCustomHook(ctx, moduleName, platform) {
  return metroResolver.resolve(
    { ...ctx, resolveRequest: metroResolver.resolve },
    moduleName,
    platform
  );
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isNative = platform === "android" || platform === "ios";

  if (isNative && moduleName === "staff-mobile-firebase-auth-rn") {
    return { type: "sourceFile", filePath: firebaseAuthRnEntry };
  }

  if (isNative && (moduleName === "firebase/auth" || moduleName === "@firebase/auth")) {
    return {
      type: "sourceFile",
      filePath: path.join(projectRoot, "src/lib/firebase-auth-entry.native.js")
    };
  }

  const sharedFile = resolveSharedSource(moduleName);
  if (sharedFile) {
    return { type: "sourceFile", filePath: sharedFile };
  }

  const normalizedModule = String(moduleName || "").replace(/\\/g, "/");
  const atFile = resolveAtAlias(normalizedModule, projectRoot);
  if (atFile) {
    return { type: "sourceFile", filePath: atFile };
  }
  if (
    normalizedModule === "expo-router/entry" ||
    normalizedModule.endsWith("/expo-router/entry") ||
    normalizedModule === "./node_modules/expo-router/entry" ||
    normalizedModule.endsWith("node_modules/expo-router/entry")
  ) {
    try {
      const filePath = require.resolve("expo-router/entry", {
        paths: [projectRoot, workspaceRoot]
      });
      return { type: "sourceFile", filePath };
    } catch {
      /* fall through to default resolution */
    }
  }

  const origin = typeof context?.originModulePath === "string" ? context.originModulePath.replace(/\\/g, "/") : "";
  const fromReactNativePackage = origin.includes("/react-native/");

  if (platform === "web" && fromReactNativePackage) {
    const norm = String(moduleName).replace(/\\/g, "/");
    if (moduleName === "../Utilities/Platform" || norm.includes("Libraries/Utilities/Platform")) {
      try {
        const filePath = require.resolve("react-native-web/dist/exports/Platform/index.js", {
          paths: [projectRoot, workspaceRoot]
        });
        return { type: "sourceFile", filePath };
      } catch {
        /* fall through */
      }
    }

    try {
      return resolveWithoutCustomHook(context, moduleName, "web");
    } catch {
      try {
        return resolveWithoutCustomHook(context, moduleName, "ios");
      } catch {
        /* fall through */
      }
    }
  }

  if (typeof upstreamResolveRequest === "function") {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
