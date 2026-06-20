import path from "node:path";
import os from "node:os";
import { config as loadDotenv } from "dotenv";
import { app, BrowserWindow, ipcMain } from "electron";
import { createServer } from "node:http";
import sqlite3 from "sqlite3";
import { Server as SocketIOServer } from "socket.io";
import {
  CloudSyncEngine,
  createDbHelpers,
  type SyncStatusPayload
} from "./cloud-sync";
import { computeTaxBreakdown, printReceipt, type ReceiptOrderData } from "./receipt-printer";
import { registerFcmIpcHandlers, startPosInboxListener } from "./fcm-listener";
import type { KitchenOrderPayload } from "./main-types";

export type { KitchenOrderPayload };

loadDotenv({ path: path.resolve(__dirname, "../../../.env") });

const HUB_PORT = Number(process.env.DESKTOP_POS_SOCKET_PORT ?? 3001);

type OrderSource = "dine-in" | "takeaway" | "zomato" | "swiggy";
type KitchenOrderStatus = "pending" | "preparing" | "ready";

type ProductRow = {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string | null;
  modifier_groups: string | null;
};

type CheckoutItem = {
  productId: number;
  quantity: number;
  price: number;
  notes?: string;
  name?: string;
};

type CheckoutPayload = {
  tableNumber?: string;
  source: OrderSource;
  items: CheckoutItem[];
  paymentMethod: string;
  specialNotes?: string;
};

let db: sqlite3.Database | null = null;
let mainWindow: BrowserWindow | null = null;
let socketHub: SocketIOServer | null = null;
let cloudSyncEngine: CloudSyncEngine | null = null;
let stopPosInboxListener: (() => void) | null = null;
let hubLocalIp = "127.0.0.1";
let latestSyncStatus: SyncStatusPayload = {
  online: false,
  unsyncedCount: 0,
  lastSyncAt: null,
  lastError: null,
  syncing: false
};

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image TEXT,
    modifier_groups TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL,
    table_number TEXT,
    source TEXT NOT NULL CHECK(source IN ('dine-in', 'takeaway', 'zomato', 'swiggy')),
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    synced_to_cloud INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    method TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`
];

const SEED_PRODUCTS: Omit<ProductRow, "id">[] = [
  { name: "Mango Smoothie", price: 120, category: "Beverages", image: null, modifier_groups: null },
  { name: "Fresh Orange Juice", price: 90, category: "Beverages", image: null, modifier_groups: null },
  { name: "Watermelon Bowl", price: 150, category: "Bowls", image: null, modifier_groups: null },
  { name: "Mixed Fruit Salad", price: 180, category: "Bowls", image: null, modifier_groups: null },
  { name: "Pineapple Sundae", price: 140, category: "Desserts", image: null, modifier_groups: null },
  { name: "Banana Split", price: 160, category: "Desserts", image: null, modifier_groups: null },
  { name: "Veg Sandwich", price: 110, category: "Snacks", image: null, modifier_groups: null },
  { name: "Fruit Parfait", price: 130, category: "Snacks", image: null, modifier_groups: null }
];

function getDatabasePath(): string {
  return path.join(app.getPath("userData"), "pos.sqlite");
}

function getLocalNetworkIp(): string {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return "127.0.0.1";
}

function pushSyncStatus(status: SyncStatusPayload): void {
  latestSyncStatus = status;
  mainWindow?.webContents.send("sync:status", status);
}

function run(dbInstance: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    dbInstance.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function get<T>(dbInstance: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    dbInstance.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

function all<T>(dbInstance: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    dbInstance.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

async function initializeDatabase(): Promise<sqlite3.Database> {
  const dbPath = getDatabasePath();
  const dbInstance = new sqlite3.Database(dbPath);

  for (const statement of SCHEMA_STATEMENTS) {
    await run(dbInstance, statement);
  }

  const countRow = await get<{ count: number }>(dbInstance, "SELECT COUNT(*) AS count FROM products");
  if ((countRow?.count ?? 0) === 0) {
    for (const product of SEED_PRODUCTS) {
      await run(
        dbInstance,
        `INSERT INTO products (name, price, category, image, modifier_groups)
         VALUES (?, ?, ?, ?, ?)`,
        [product.name, product.price, product.category, product.image, product.modifier_groups]
      );
    }
  }

  return dbInstance;
}

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `POS-${stamp}-${suffix}`;
}

async function resolveProductName(productId: number): Promise<string> {
  if (!db) return `Item #${productId}`;
  const row = await get<{ name: string }>(db, "SELECT name FROM products WHERE id = ?", [productId]);
  return row?.name ?? `Item #${productId}`;
}

async function buildKitchenOrder(
  orderId: number,
  orderNumber: string,
  payload: CheckoutPayload,
  total: number,
  createdAt: string
): Promise<KitchenOrderPayload> {
  const items = await Promise.all(
    payload.items.map(async (item) => ({
      productId: item.productId,
      name: item.name ?? (await resolveProductName(item.productId)),
      quantity: item.quantity,
      price: item.price,
      notes: item.notes
    }))
  );

  return {
    orderId,
    orderNumber,
    tableNumber: payload.tableNumber,
    source: payload.source,
    total,
    status: "pending",
    createdAt,
    specialNotes: payload.specialNotes,
    items
  };
}

function buildReceiptOrderData(
  kitchenOrder: KitchenOrderPayload,
  paymentMethod: string
): ReceiptOrderData {
  const subtotal = kitchenOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const { tax, total } = computeTaxBreakdown(subtotal);

  return {
    orderId: kitchenOrder.orderId,
    orderNumber: kitchenOrder.orderNumber,
    tableNumber: kitchenOrder.tableNumber,
    source: kitchenOrder.source,
    paymentMethod,
    createdAt: kitchenOrder.createdAt,
    specialNotes: kitchenOrder.specialNotes,
    items: kitchenOrder.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes
    })),
    subtotal,
    tax,
    total
  };
}

function broadcastNewOrder(order: KitchenOrderPayload): void {
  if (!socketHub) return;
  socketHub.emit("new-order", order);
  console.info(`[hub] Broadcast new-order ${order.orderNumber} to kitchen clients`);
}

async function checkoutOrder(payload: CheckoutPayload): Promise<KitchenOrderPayload> {
  if (!db) throw new Error("Database not initialized");
  if (!payload.items.length) throw new Error("Cart is empty");

  const subtotal = payload.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const { total } = computeTaxBreakdown(subtotal);
  const orderNumber = generateOrderNumber();
  const createdAt = new Date().toISOString();

  await run(db, "BEGIN TRANSACTION");

  try {
    await run(
      db,
      `INSERT INTO orders (order_number, table_number, source, total, status, created_at, synced_to_cloud)
       VALUES (?, ?, ?, ?, 'open', ?, 0)`,
      [orderNumber, payload.tableNumber ?? null, payload.source, total, createdAt]
    );

    const orderRow = await get<{ id: number }>(db, "SELECT last_insert_rowid() AS id");
    const orderId = orderRow?.id;
    if (!orderId) throw new Error("Failed to create order");

    for (const item of payload.items) {
      await run(
        db,
        `INSERT INTO order_items (order_id, product_id, quantity, price, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.quantity, item.price, item.notes ?? null]
      );
    }

    await run(
      db,
      `INSERT INTO payments (order_id, method, amount, status)
       VALUES (?, ?, ?, 'completed')`,
      [orderId, payload.paymentMethod, total]
    );

    await run(db, "COMMIT");

    const kitchenOrder = await buildKitchenOrder(orderId, orderNumber, payload, total, createdAt);
    console.info(`[pos] Order saved locally: ${orderNumber} (id=${orderId}, total=${total})`);

    return kitchenOrder;
  } catch (error) {
    await run(db, "ROLLBACK");
    throw error;
  }
}

async function updateOrderKitchenStatus(orderId: number, status: KitchenOrderStatus): Promise<void> {
  if (!db) throw new Error("Database not initialized");

  const dbStatus = status === "ready" ? "ready" : status === "preparing" ? "preparing" : "open";
  await run(db, "UPDATE orders SET status = ? WHERE id = ?", [dbStatus, orderId]);
}

function registerIpcHandlers(): void {
  ipcMain.handle("db:getProducts", async () => {
    if (!db) throw new Error("Database not initialized");
    return all<ProductRow>(db, "SELECT * FROM products ORDER BY category, name");
  });

  ipcMain.handle("db:getCategories", async () => {
    if (!db) throw new Error("Database not initialized");
    const rows = await all<{ category: string }>(
      db,
      "SELECT DISTINCT category FROM products ORDER BY category"
    );
    return rows.map((row) => row.category);
  });

  ipcMain.handle("db:checkout", async (_event, payload: CheckoutPayload) => {
    const kitchenOrder = await checkoutOrder(payload);
    const receiptData = buildReceiptOrderData(kitchenOrder, payload.paymentMethod);

    void printReceipt(receiptData).then((result) => {
      if (!result.ok) {
        console.warn(`[print] Receipt skipped for ${kitchenOrder.orderNumber}: ${result.error ?? "unknown"}`);
      }
    });

    void cloudSyncEngine?.runNow();

    mainWindow?.webContents.send("order:created", kitchenOrder);
    return kitchenOrder;
  });

  ipcMain.handle("hub:emitNewOrder", async (_event, order: KitchenOrderPayload) => {
    broadcastNewOrder(order);
    return { ok: true };
  });

  ipcMain.handle("hub:getInfo", async () => ({
    port: HUB_PORT,
    localIp: hubLocalIp
  }));

  ipcMain.handle("sync:getStatus", async () => latestSyncStatus);
}

function startLocalWebSocketHub(): SocketIOServer {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    console.info(`[hub] Client connected: ${socket.id}`);

    socket.on("new-order", (order: KitchenOrderPayload) => {
      console.info(`[hub] Received new-order from ${socket.id}: ${order.orderNumber}`);
      io.emit("new-order", order);
    });

    socket.on(
      "order-status-update",
      async (payload: { orderId: number; orderNumber: string; status: KitchenOrderStatus }) => {
        try {
          await updateOrderKitchenStatus(payload.orderId, payload.status);
          io.emit("order-status-update", payload);
          console.info(`[hub] Order ${payload.orderNumber} status -> ${payload.status}`);
        } catch (error) {
          console.error("[hub] Failed to update order status:", error);
        }
      }
    );

    socket.on("disconnect", () => {
      console.info(`[hub] Client disconnected: ${socket.id}`);
    });
  });

  hubLocalIp = getLocalNetworkIp();

  httpServer.listen(HUB_PORT, "0.0.0.0", () => {
    console.info(`WebSocket server running on local IP: ${hubLocalIp}:${HUB_PORT}`);
  });

  return io;
}

function startCloudSyncEngine(database: sqlite3.Database): CloudSyncEngine {
  const engine = new CloudSyncEngine(createDbHelpers(database));
  engine.start((status) => {
    pushSyncStatus(status);
  });
  return engine;
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "Desktop POS",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  db = await initializeDatabase();
  registerIpcHandlers();

  if (db) {
    registerFcmIpcHandlers(db, {
      onKitchenOrder: (order) => {
        broadcastNewOrder(order);
        mainWindow?.webContents.send("order:created", order);
      }
    });
    stopPosInboxListener = startPosInboxListener(db, {
      onKitchenOrder: (order) => {
        broadcastNewOrder(order);
        mainWindow?.webContents.send("order:created", order);
      }
    });
  }

  socketHub = startLocalWebSocketHub();
  cloudSyncEngine = startCloudSyncEngine(db);
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopPosInboxListener?.();
  cloudSyncEngine?.stop();
  if (db) {
    db.close();
    db = null;
  }
});

export {};
