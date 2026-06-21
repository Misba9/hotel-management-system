import path from "node:path";
import { app } from "electron";
import sqlite3 from "sqlite3";
import type { CachedOrderRecord } from "./main-types";

const SCHEMA = `CREATE TABLE IF NOT EXISTS pending_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  error TEXT
)`;

function dbPath(): string {
  return path.join(app.getPath("userData"), "staff-offline-cache.sqlite");
}

function run(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

function all<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
  });
}

function get<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined)));
  });
}

export class OfflineOrderCache {
  private db: sqlite3.Database | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const instance = new sqlite3.Database(dbPath(), (err) => (err ? reject(err) : resolve(instance)));
    });
    await run(this.db, SCHEMA);
  }

  private requireDb(): sqlite3.Database {
    if (!this.db) throw new Error("Offline cache not initialized");
    return this.db;
  }

  async enqueue(payload: Record<string, unknown>): Promise<number> {
    const db = this.requireDb();
    const createdAt = new Date().toISOString();
    await run(db, "INSERT INTO pending_orders (payload, created_at, synced) VALUES (?, ?, 0)", [
      JSON.stringify(payload),
      createdAt
    ]);
    const row = await get<{ id: number }>(db, "SELECT last_insert_rowid() AS id");
    return row?.id ?? 0;
  }

  async listPending(): Promise<CachedOrderRecord[]> {
    const db = this.requireDb();
    const rows = await all<{
      id: number;
      payload: string;
      created_at: string;
      synced: number;
      error: string | null;
    }>(db, "SELECT id, payload, created_at, synced, error FROM pending_orders WHERE synced = 0 ORDER BY id ASC");

    return rows.map((row) => ({
      id: row.id,
      payload: row.payload,
      createdAt: row.created_at,
      synced: row.synced === 1,
      error: row.error
    }));
  }

  async markSynced(id: number): Promise<void> {
    await run(this.requireDb(), "UPDATE pending_orders SET synced = 1, error = NULL WHERE id = ?", [id]);
  }

  async markFailed(id: number, error: string): Promise<void> {
    await run(this.requireDb(), "UPDATE pending_orders SET error = ? WHERE id = ?", [error, id]);
  }

  async pendingCount(): Promise<number> {
    const row = await get<{ count: number }>(
      this.requireDb(),
      "SELECT COUNT(*) AS count FROM pending_orders WHERE synced = 0"
    );
    return row?.count ?? 0;
  }

  async close(): Promise<void> {
    if (!this.db) return;
    await new Promise<void>((resolve, reject) => {
      this.db!.close((err) => (err ? reject(err) : resolve()));
    });
    this.db = null;
  }
}

export const offlineOrderCache = new OfflineOrderCache();
