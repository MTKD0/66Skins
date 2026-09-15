import { env } from "cloudflare:workers";

export type RecentDropRecord = {
  id: string;
  boxId: number;
  boxName: string;
  boxImageUrl: string;
  itemId: number;
  itemName: string;
  itemImageUrl: string;
  rarity: "blue" | "purple" | "pink" | "red" | "gold" | "white";
  userName: string;
  openedAt: string;
};

let recentDropsInitialization: Promise<void> | null = null;

function getD1() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable");
  return env.DB;
}

async function initializeRecentDropsDatabase() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS recent_drops (
      id TEXT PRIMARY KEY,
      box_id INTEGER NOT NULL,
      box_name TEXT NOT NULL,
      box_image_url TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      item_image_url TEXT NOT NULL,
      rarity TEXT NOT NULL,
      user_name TEXT NOT NULL,
      opened_at TEXT NOT NULL
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_recent_drops_opened_at ON recent_drops(opened_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_recent_drops_box_opened ON recent_drops(box_id, opened_at)"),
  ]);
  await d1.prepare("PRAGMA optimize").run();
}

export async function ensureRecentDropsDatabase() {
  recentDropsInitialization ??= initializeRecentDropsDatabase().catch((error) => {
    recentDropsInitialization = null;
    throw error;
  });
  return recentDropsInitialization;
}

export async function listRecentDrops({ boxId, limit = 30 }: { boxId?: number; limit?: number } = {}) {
  await ensureRecentDropsDatabase();
  const safeLimit = Math.max(1, Math.min(60, Math.trunc(limit)));
  const select = `SELECT id, box_id AS boxId, box_name AS boxName, box_image_url AS boxImageUrl,
    item_id AS itemId, item_name AS itemName, item_image_url AS itemImageUrl,
    rarity, user_name AS userName, opened_at AS openedAt FROM recent_drops`;
  const query = boxId == null
    ? getD1().prepare(`${select} ORDER BY opened_at DESC, rowid DESC LIMIT ?`).bind(safeLimit)
    : getD1().prepare(`${select} WHERE box_id = ? ORDER BY opened_at DESC, rowid DESC LIMIT ?`).bind(boxId, safeLimit);
  const rows = await query.all<RecentDropRecord>();
  return rows.results;
}

export async function addRecentDrops(records: Array<Omit<RecentDropRecord, "id" | "openedAt">>) {
  await ensureRecentDropsDatabase();
  if (!records.length) return [];
  const openedAt = new Date().toISOString();
  const rows = records.map((record) => ({ ...record, id: crypto.randomUUID(), openedAt }));
  await getD1().batch(rows.map((row) => getD1().prepare(`INSERT INTO recent_drops
    (id, box_id, box_name, box_image_url, item_id, item_name, item_image_url, rarity, user_name, opened_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.boxId, row.boxName, row.boxImageUrl, row.itemId, row.itemName, row.itemImageUrl, row.rarity, row.userName, row.openedAt)));
  return rows;
}
