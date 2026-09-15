import { env } from "cloudflare:workers";
import { getClassicBoxMarketValues } from "./prices";

export type BackpackItemRecord = {
  id: string;
  boxId: number;
  itemName: string;
  imageUrl: string;
  value: number;
  acquiredAt: string;
  status: "available" | "recycled";
};

let backpackInitialization: Promise<void> | null = null;

function getD1() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable");
  return env.DB;
}

async function initializeBackpackDatabase() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS backpack_items (
      id TEXT PRIMARY KEY,
      box_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      value REAL NOT NULL,
      acquired_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available'
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_backpack_items_status_acquired ON backpack_items(status, acquired_at)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS recycle_records (
      id TEXT PRIMARY KEY,
      backpack_item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      value REAL NOT NULL,
      recycled_at TEXT NOT NULL
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_recycle_records_recycled_at ON recycle_records(recycled_at)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS trade_settings (
      id INTEGER PRIMARY KEY,
      trade_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )`),
  ]);
  await d1.prepare("PRAGMA optimize").run();
}

export async function ensureBackpackDatabase() {
  backpackInitialization ??= initializeBackpackDatabase().catch((error) => {
    backpackInitialization = null;
    throw error;
  });
  return backpackInitialization;
}

export async function listBackpackItems(sort: "newest" | "oldest" | "value-desc" | "value-asc" = "newest") {
  await ensureBackpackDatabase();
  const orderBy = sort === "oldest" ? "acquired_at ASC" : sort === "value-desc" ? "value DESC" : sort === "value-asc" ? "value ASC" : "acquired_at DESC";
  const rows = await getD1().prepare(`SELECT id, box_id AS boxId, item_name AS itemName, image_url AS imageUrl,
    value, acquired_at AS acquiredAt, status FROM backpack_items WHERE status = 'available' ORDER BY ${orderBy}`).all<BackpackItemRecord>();
  const market = await getClassicBoxMarketValues();
  const valueByBoxId = new Map(market.values.map((entry) => [entry.boxId, entry.itemValue]));
  const valuedRows = rows.results.map((row) => ({ ...row, value: valueByBoxId.get(row.boxId) ?? row.value }));
  if (sort === "value-desc") valuedRows.sort((left, right) => right.value - left.value);
  if (sort === "value-asc") valuedRows.sort((left, right) => left.value - right.value);
  return valuedRows;
}

export async function listRecycleRecords() {
  await ensureBackpackDatabase();
  const rows = await getD1().prepare(`SELECT id, backpack_item_id AS backpackItemId, item_name AS itemName,
    image_url AS imageUrl, value, recycled_at AS recycledAt FROM recycle_records ORDER BY recycled_at DESC`).all();
  return rows.results;
}

export async function addBackpackItem(input: Omit<BackpackItemRecord, "id" | "acquiredAt" | "status">) {
  await ensureBackpackDatabase();
  const record: BackpackItemRecord = {
    ...input,
    id: crypto.randomUUID(),
    acquiredAt: new Date().toISOString(),
    status: "available",
  };
  await getD1().prepare(`INSERT INTO backpack_items (id, box_id, item_name, image_url, value, acquired_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'available')`).bind(record.id, record.boxId, record.itemName, record.imageUrl, record.value, record.acquiredAt).run();
  return record;
}

export async function recycleBackpackItems(ids: string[]) {
  await ensureBackpackDatabase();
  const d1 = getD1();
  const market = await getClassicBoxMarketValues();
  const valueByBoxId = new Map(market.values.map((entry) => [entry.boxId, entry.itemValue]));
  const records: Array<{ id: string; boxId: number; itemName: string; imageUrl: string; value: number }> = [];
  for (const id of ids) {
    const item = await d1.prepare(`SELECT id, box_id AS boxId, item_name AS itemName, image_url AS imageUrl, value
      FROM backpack_items WHERE id = ? AND status = 'available'`).bind(id).first<{ id: string; boxId: number; itemName: string; imageUrl: string; value: number }>();
    if (item) records.push({ ...item, value: valueByBoxId.get(item.boxId) ?? item.value });
  }
  if (!records.length) return { count: 0, totalValue: 0 };
  const recycledAt = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const item of records) {
    statements.push(d1.prepare("UPDATE backpack_items SET status = 'recycled' WHERE id = ? AND status = 'available'").bind(item.id));
    statements.push(d1.prepare(`INSERT INTO recycle_records (id, backpack_item_id, item_name, image_url, value, recycled_at)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), item.id, item.itemName, item.imageUrl, item.value, recycledAt));
  }
  await d1.batch(statements);
  return { count: records.length, totalValue: records.reduce((sum, item) => sum + Number(item.value), 0) };
}

export async function getTradeUrl() {
  await ensureBackpackDatabase();
  const row = await getD1().prepare("SELECT trade_url AS tradeUrl FROM trade_settings WHERE id = 1").first<{ tradeUrl: string }>();
  return row?.tradeUrl ?? "";
}

export async function saveTradeUrl(tradeUrl: string) {
  await ensureBackpackDatabase();
  await getD1().prepare(`INSERT INTO trade_settings (id, trade_url, updated_at) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET trade_url = excluded.trade_url, updated_at = excluded.updated_at`).bind(tradeUrl, new Date().toISOString()).run();
  return tradeUrl;
}
