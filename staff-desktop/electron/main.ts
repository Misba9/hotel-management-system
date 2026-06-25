import path from "node:path";
import { config as loadDotenv } from "dotenv";
import AutoLaunch from "auto-launch";
import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import { offlineOrderCache } from "./offline-cache";
import { listPrinterDevices, printInvoice, printKot } from "./receipt-printer";
import { loadSettings, saveSettings } from "./settings-store";
import { razorpayInitiatePayment, razorpayVerifyPayment, readRazorpayPublicKey } from "./razorpay-service";
import type {
  FirebaseClientConfig,
  OfflineSyncStatus,
  PrintInvoicePayload,
  PrintKotPayload,
  RazorpayInitiatePayload,
  RazorpayInitiateResult,
  RazorpayVerifyPayload,
  StaffDesktopSettings
} from "./main-types";

const repoRoot = path.resolve(__dirname, "../../..");
const adminEnvDir = path.join(repoRoot, "admin-dashboard");

loadDotenv({ path: path.join(adminEnvDir, ".env.local") });
loadDotenv({ path: path.join(adminEnvDir, ".env") });
loadDotenv({ path: path.join(repoRoot, ".env") });

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let autoLauncher: AutoLaunch | null = null;
let latestSyncStatus: OfflineSyncStatus = {
  online: true,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
  syncing: false
};

function env(name: string): string | undefined {
  const raw = process.env[name];
  return raw?.trim() || undefined;
}

function readFirebaseConfig(): FirebaseClientConfig {
  return {
    apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY") ?? env("VITE_FIREBASE_API_KEY") ?? "",
    authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") ?? env("VITE_FIREBASE_AUTH_DOMAIN") ?? "",
    projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? env("VITE_FIREBASE_PROJECT_ID") ?? "",
    storageBucket:
      env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") ?? env("VITE_FIREBASE_STORAGE_BUCKET") ?? "",
    messagingSenderId:
      env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") ?? env("VITE_FIREBASE_MESSAGING_SENDER_ID") ?? "",
    appId: env("NEXT_PUBLIC_FIREBASE_APP_ID") ?? env("VITE_FIREBASE_APP_ID") ?? ""
  };
}

function pushSyncStatus(partial: Partial<OfflineSyncStatus>): void {
  latestSyncStatus = { ...latestSyncStatus, ...partial };
  mainWindow?.webContents.send("offline:status", latestSyncStatus);
}

async function refreshPendingCount(): Promise<void> {
  const pendingCount = await offlineOrderCache.pendingCount();
  pushSyncStatus({ pendingCount });
}

async function applyAutoLaunch(enabled: boolean): Promise<void> {
  if (!autoLauncher) {
    autoLauncher = new AutoLaunch({
      name: "Nausheen Staff",
      path: app.getPath("exe"),
      isHidden: false
    });
  }
  try {
    const isEnabled = await autoLauncher.isEnabled();
    if (enabled && !isEnabled) await autoLauncher.enable();
    if (!enabled && isEnabled) await autoLauncher.disable();
  } catch (error) {
    console.warn("[auto-launch] Failed to update startup setting:", error);
  }
}

function createMainWindow(): void {
  const settings = loadSettings();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0f172a" : "#f1f5f9",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (settings.fullscreen) {
      mainWindow?.setFullScreen(true);
    }
  });

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5177");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("settings:get", (): StaffDesktopSettings => loadSettings());

  ipcMain.handle("settings:save", async (_event, partial: Partial<StaffDesktopSettings>) => {
    const next = saveSettings(partial);
    if (typeof partial.autoLaunch === "boolean") {
      await applyAutoLaunch(partial.autoLaunch);
    }
    if (typeof partial.fullscreen === "boolean") {
      mainWindow?.setFullScreen(partial.fullscreen);
    }
    return next;
  });

  ipcMain.handle("window:toggleFullscreen", () => {
    const current = mainWindow?.isFullScreen() ?? false;
    mainWindow?.setFullScreen(!current);
    saveSettings({ fullscreen: !current });
    return !current;
  });

  ipcMain.handle("window:isFullscreen", () => mainWindow?.isFullScreen() ?? false);

  ipcMain.handle("printer:list", () => listPrinterDevices());

  ipcMain.handle("printer:printInvoice", (_event, payload: PrintInvoicePayload) => printInvoice(payload));

  ipcMain.handle("printer:printKot", (_event, payload: PrintKotPayload) => printKot(payload));

  ipcMain.handle("firebase:getClientConfig", () => readFirebaseConfig());

  ipcMain.handle("offline:enqueue", async (_event, payload: Record<string, unknown>) => {
    const id = await offlineOrderCache.enqueue(payload);
    await refreshPendingCount();
    return { id };
  });

  ipcMain.handle("offline:listPending", () => offlineOrderCache.listPending());

  ipcMain.handle("offline:markSynced", async (_event, id: number) => {
    await offlineOrderCache.markSynced(id);
    await refreshPendingCount();
    return { ok: true };
  });

  ipcMain.handle("offline:markFailed", async (_event, id: number, error: string) => {
    await offlineOrderCache.markFailed(id, error);
    await refreshPendingCount();
    return { ok: true };
  });

  ipcMain.handle("offline:getStatus", (): OfflineSyncStatus => latestSyncStatus);

  ipcMain.handle("offline:setOnline", async (_event, online: boolean) => {
    pushSyncStatus({ online });
    if (online) {
      mainWindow?.webContents.send("offline:sync-request");
    }
    return latestSyncStatus;
  });

  ipcMain.handle("offline:syncStarted", () => {
    pushSyncStatus({ syncing: true, lastError: null });
    return latestSyncStatus;
  });

  ipcMain.handle("offline:syncFinished", async (_event, result: { ok: boolean; error?: string }) => {
    pushSyncStatus({
      syncing: false,
      lastSyncAt: result.ok ? new Date().toISOString() : latestSyncStatus.lastSyncAt,
      lastError: result.ok ? null : (result.error ?? "sync_failed")
    });
    await refreshPendingCount();
    return latestSyncStatus;
  });

  ipcMain.handle("sound:playNewOrder", () => {
    mainWindow?.webContents.send("sound:new-order");
    return { ok: true };
  });

  ipcMain.handle("razorpay:getKeyId", () => readRazorpayPublicKey(process.env));

  ipcMain.handle("razorpay:initiate", async (_event, payload: RazorpayInitiatePayload): Promise<RazorpayInitiateResult> => {
    return razorpayInitiatePayment(payload, process.env);
  });

  ipcMain.handle("razorpay:verify", async (_event, payload: RazorpayVerifyPayload) => {
    return razorpayVerifyPayment(payload, process.env);
  });
}

app.whenReady().then(async () => {
  await offlineOrderCache.init();
  registerIpcHandlers();

  const settings = loadSettings();
  await applyAutoLaunch(settings.autoLaunch);
  await refreshPendingCount();

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    void offlineOrderCache.close();
    app.quit();
  }
});

app.on("before-quit", () => {
  void offlineOrderCache.close();
});
