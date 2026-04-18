const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");
const metroResolver = require("metro-resolver");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

function resolvePackageDir(packageName) {
  return path.dirname(
    require.resolve(`${packageName}/package.json`, { paths: [projectRoot] })
  );
}

/** RN 0.74 keeps this package nested under react-native/node_modules; Metro + disableHierarchicalLookup won't find it otherwise. */
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

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

// Monorepo: npm hoists multiple React versions (Next/Radix vs Expo). Metro must use ONE
// instance or hooks break with "Cannot read property 'useId' of null".
const deduped = {
  react: resolvePackageDir("react"),
  "react-dom": resolvePackageDir("react-dom"),
  "@react-native/virtualized-lists": resolveVirtualizedListsDir(),
};
try {
  deduped.scheduler = resolvePackageDir("scheduler");
} catch {
  // optional peer layout
}

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...deduped,
};

config.resolver.disableHierarchicalLookup = false;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

/**
 * Web + Metro: many `react-native` internals only ship `.ios.js` / `.android.js` (no `.web.js` / bare `.js`).
 * 1) Map `Libraries/Utilities/Platform` → `react-native-web` (real `Platform` for web).
 * 2) For other relative imports inside `react-native`, try `web` then fall back to `ios` (matches RN macOS/desktop patterns).
 */
const upstreamResolveRequest = config.resolver.resolveRequest;

function resolveWithoutCustomHook(ctx, moduleName, platform) {
  return metroResolver.resolve(
    { ...ctx, resolveRequest: metroResolver.resolve },
    moduleName,
    platform
  );
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
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
        /* fall through to default path */
      }
    }
  }

  if (typeof upstreamResolveRequest === "function") {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
