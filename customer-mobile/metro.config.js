/**
 * Customer mobile (monorepo):
 * - Prefer `customer-mobile/node_modules`, then repo root (npm hoists many packages there).
 * - Watch only this app + `shared/` — do not watch admin-dashboard / staff-mobile.
 * - `@shared/*` → source files under `../shared`.
 * - Firebase dual-package hazard fix (Expo SDK 53+): force ESM for `@firebase/*`.
 *   See: https://github.com/expo/expo/issues/36598#issuecomment-2848750540
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
  throw new Error(`[customer-mobile metro] Could not resolve package: ${packageName}`);
}

/** Use the @firebase/auth copy bundled with `firebase` (avoids hoisted mismatch). */
function resolveFirebaseNestedAuthDir() {
  const firebaseDir = resolvePackageDir("firebase", true);
  const nested = path.join(firebaseDir, "node_modules", "@firebase", "auth");
  if (fs.existsSync(path.join(nested, "package.json"))) {
    return nested;
  }
  return resolvePackageDir("@firebase/auth");
}

const firebaseAuthRnEntry = path.join(resolveFirebaseNestedAuthDir(), "dist", "rn", "index.js");

/**
 * Absolute ESM entries for core @firebase packages.
 * Auth's RN build does require('@firebase/app') (CJS); firebase/app loads ESM.
 * Pinning both sides to the same ESM file avoids the dual-package hazard.
 */
function resolveFirebaseEsmEntry(packageName) {
  const dir = resolvePackageDir(packageName, true);
  const pkgJson = require(path.join(dir, "package.json"));
  const candidates = [
    pkgJson.module && path.join(dir, pkgJson.module),
    path.join(dir, "dist", "esm", "index.esm2017.js"),
    path.join(dir, "dist", "index.esm2017.js"),
    path.join(dir, "dist", "esm", "index.esm.js"),
    path.join(dir, "dist", "index.esm.js")
  ].filter(Boolean);
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  throw new Error(`[customer-mobile metro] No ESM entry for ${packageName}`);
}

const firebaseEsmEntries = {};
for (const pkg of [
  "@firebase/app",
  "@firebase/component",
  "@firebase/util",
  "@firebase/logger",
  "@firebase/firestore"
]) {
  try {
    firebaseEsmEntries[pkg] = resolveFirebaseEsmEntry(pkg);
  } catch {
    /* optional */
  }
}

try {
  const firebaseAppEsm = path.join(
    resolvePackageDir("firebase", true),
    "app",
    "dist",
    "esm",
    "index.esm.js"
  );
  if (fs.existsSync(firebaseAppEsm)) {
    firebaseEsmEntries["firebase/app"] = firebaseAppEsm;
  }
} catch {
  /* optional */
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
config.resolver.disableHierarchicalLookup = true;

if (!config.resolver.sourceExts.includes("cjs")) {
  config.resolver.sourceExts.push("cjs");
}

const deduped = {
  react: resolvePackageDir("react", true),
  "react-dom": resolvePackageDir("react-dom", true),
  "@react-native/virtualized-lists": resolveVirtualizedListsDir()
};
try {
  deduped.scheduler = resolvePackageDir("scheduler");
} catch {
  /* optional */
}
try {
  deduped["expo-router"] = resolvePackageDir("expo-router");
} catch {
  /* optional */
}
try {
  deduped["expo-notifications"] = resolvePackageDir("expo-notifications");
} catch {
  /* optional */
}
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
  deduped["@firebase/component"] = resolvePackageDir("@firebase/component", true);
} catch {
  /* optional */
}
try {
  deduped["@firebase/util"] = resolvePackageDir("@firebase/util", true);
} catch {
  /* optional */
}
try {
  deduped["@firebase/logger"] = resolvePackageDir("@firebase/logger", true);
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
  deduped["whatwg-fetch"] = resolvePackageDir("whatwg-fetch");
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

function resolveWithContext(context, moduleName, platform) {
  if (typeof upstreamResolveRequest === "function") {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return metroResolver.resolve(
    { ...context, resolveRequest: metroResolver.resolve },
    moduleName,
    platform
  );
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isNative = platform === "android" || platform === "ios";

  if (isNative && moduleName === "customer-mobile-firebase-auth-rn") {
    return { type: "sourceFile", filePath: firebaseAuthRnEntry };
  }

  // Native: always load the React Native Auth build (registers auth + AsyncStorage persistence).
  if (isNative && (moduleName === "firebase/auth" || moduleName === "@firebase/auth")) {
    return {
      type: "sourceFile",
      filePath: path.join(projectRoot, "src/lib/firebase-auth-entry.native.js")
    };
  }

  // Dual-package hazard fix: pin @firebase/* to one ESM file so Auth's
  // require('@firebase/app') and firebase/app share the same registry.
  // See: https://github.com/expo/expo/issues/36598#issuecomment-2848750540
  if (typeof moduleName === "string" && firebaseEsmEntries[moduleName]) {
    return { type: "sourceFile", filePath: firebaseEsmEntries[moduleName] };
  }

  if (moduleName === "whatwg-fetch") {
    return {
      type: "sourceFile",
      filePath: path.join(resolvePackageDir("whatwg-fetch"), "dist/fetch.umd.js")
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
      /* fall through */
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

  return resolveWithContext(context, moduleName, platform);
};

module.exports = config;
