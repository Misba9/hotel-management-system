import type sqlite3 from "sqlite3";
import type { KitchenOrderPayload } from "./main-types";

export type PlatformOrderIngestPayload = {
  orderId: string;
  orderNumber: string;
  source: "zomato" | "swiggy";
  customerName?: string;
  phone?: string;
  items: Array<{
    productId?: string;
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal?: number;
    note?: string;
  }>;
  total: number;
  paymentMethod?: string;
  specialNotes?: string;
};

type DbOps = {
  run: (sql: string, params?: unknown[]) => Promise<void>;
  get: <T>(sql: string, params?: unknown[]) => Promise<T | undefined>;
};

let platformProductId: number | null = null;

async function ensurePlatformProductId(db: DbOps): Promise<number> {
  if (platformProductId != null) return platformProductId;

  const existing = await db.get<{ id: number }>(
    "SELECT id FROM products WHERE name = ? LIMIT 1",
    ["Platform Item"]
  );
  if (existing?.id) {
    platformProductId = existing.id;
    return existing.id;
  }

  await db.run(
    `INSERT INTO products (name, price, category, image, modifier_groups)
     VALUES (?, 0, 'External', NULL, NULL)`,
    ["Platform Item"]
  );
  const created = await db.get<{ id: number }>("SELECT last_insert_rowid() AS id");
  platformProductId = created?.id ?? 1;
  return platformProductId;
}

export function createDbOps(db: sqlite3.Database): DbOps {
  return {
    run: (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    get: (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row as never);
        });
      })
  };
}

export async function insertPlatformOrder(
  db: sqlite3.Database,
  payload: PlatformOrderIngestPayload
): Promise<KitchenOrderPayload | null> {
  const ops = createDbOps(db);

  const existing = await ops.get<{ id: number }>(
    "SELECT id FROM orders WHERE order_number = ? LIMIT 1",
    [payload.orderNumber]
  );
  if (existing?.id) {
    console.info(`[pos-ingest] Order ${payload.orderNumber} already exists locally`);
    return null;
  }

  const productId = await ensurePlatformProductId(ops);
  const createdAt = new Date().toISOString();
  const specialNotes = [
    payload.specialNotes?.trim(),
    payload.customerName ? `Customer: ${payload.customerName}` : "",
    payload.phone ? `Phone: ${payload.phone}` : ""
  ]
    .filter(Boolean)
    .join(" · ");

  await ops.run("BEGIN TRANSACTION");

  try {
    await ops.run(
      `INSERT INTO orders (order_number, table_number, source, total, status, created_at, synced_to_cloud)
       VALUES (?, NULL, ?, ?, 'open', ?, 1)`,
      [payload.orderNumber, payload.source, payload.total, createdAt]
    );

    const orderRow = await ops.get<{ id: number }>("SELECT last_insert_rowid() AS id");
    const orderId = orderRow?.id;
    if (!orderId) throw new Error("Failed to create platform order");

    for (const item of payload.items) {
      await ops.run(
        `INSERT INTO order_items (order_id, product_id, quantity, price, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          productId,
          item.qty,
          item.unitPrice,
          item.note ?? item.name
        ]
      );
    }

    await ops.run(
      `INSERT INTO payments (order_id, method, amount, status)
       VALUES (?, ?, ?, 'completed')`,
      [orderId, payload.paymentMethod ?? "online", payload.total]
    );

    await ops.run("COMMIT");

    return {
      orderId,
      orderNumber: payload.orderNumber,
      source: payload.source,
      total: payload.total,
      status: "pending",
      createdAt,
      specialNotes: specialNotes || undefined,
      items: payload.items.map((item, index) => ({
        productId,
        name: item.name,
        quantity: item.qty,
        price: item.unitPrice,
        notes: item.note
      }))
    };
  } catch (error) {
    await ops.run("ROLLBACK");
    throw error;
  }
}

export function parseFcmPlatformOrder(data: Record<string, string>): PlatformOrderIngestPayload | null {
  if (data.type !== "platform_order") return null;
  if (data.source !== "zomato" && data.source !== "swiggy") return null;

  let items: PlatformOrderIngestPayload["items"] = [];
  if (data.items) {
    try {
      const parsed = JSON.parse(data.items) as Array<Record<string, unknown>>;
      items = parsed.map((row, index) => ({
        productId: typeof row.productId === "string" ? row.productId : undefined,
        name: String(row.name ?? `Item ${index + 1}`),
        qty: Number(row.qty ?? row.quantity ?? 1),
        unitPrice: Number(row.unitPrice ?? row.price ?? 0),
        lineTotal: Number(row.lineTotal ?? row.total ?? 0),
        note: typeof row.note === "string" ? row.note : undefined
      }));
    } catch {
      items = [];
    }
  }

  return {
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    source: data.source,
    customerName: data.customerName,
    phone: data.phone,
    items,
    total: Number(data.total ?? 0),
    paymentMethod: data.paymentMethod,
    specialNotes: data.specialNotes
  };
}
