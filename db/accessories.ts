import { env } from "cloudflare:workers";
import seedData from "../data/accessories.seed.json";

type SeedAccessory = (typeof seedData)[number];

const SOURCE_UPDATED_AT = "2026-08-16T00:00:00.000Z";
const INSERT_COLUMNS = [
  "id",
  "name",
  "market_name",
  "description",
  "weapon_id",
  "weapon_name",
  "category_id",
  "category_name",
  "pattern_name",
  "min_float",
  "max_float",
  "rarity_id",
  "rarity_name",
  "rarity_color",
  "stattrak",
  "souvenir",
  "paint_index",
  "wears_json",
  "image_url",
  "source",
  "source_url",
  "updated_at",
] as const;

let initialization: Promise<void> | null = null;

function getD1() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable");
  return env.DB;
}

function seedValues(item: SeedAccessory) {
  return [
    item.id,
    item.name,
    item.marketName,
    item.description,
    item.weaponId,
    item.weaponName,
    item.categoryId,
    item.categoryName,
    item.patternName,
    item.minFloat,
    item.maxFloat,
    item.rarityId,
    item.rarityName,
    item.rarityColor,
    item.stattrak ? 1 : 0,
    item.souvenir ? 1 : 0,
    item.paintIndex,
    JSON.stringify(item.wears),
    item.imageUrl,
    item.source,
    item.sourceUrl,
    SOURCE_UPDATED_AT,
  ];
}

async function initializeDatabase() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS accessories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      market_name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      weapon_id TEXT NOT NULL,
      weapon_name TEXT NOT NULL,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      pattern_name TEXT NOT NULL DEFAULT '',
      min_float REAL,
      max_float REAL,
      rarity_id TEXT NOT NULL,
      rarity_name TEXT NOT NULL,
      rarity_color TEXT NOT NULL DEFAULT '#b0c3d9',
      stattrak INTEGER NOT NULL DEFAULT 0,
      souvenir INTEGER NOT NULL DEFAULT 0,
      paint_index TEXT,
      wears_json TEXT NOT NULL DEFAULT '[]',
      image_url TEXT NOT NULL,
      price_cny REAL,
      price_tokens REAL,
      price_source TEXT,
      source TEXT NOT NULL,
      source_url TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_accessories_category ON accessories(category_name)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_accessories_weapon ON accessories(weapon_name)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_accessories_rarity ON accessories(rarity_id)"),
  ]);

  const columns = await d1.prepare("PRAGMA table_info(accessories)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "market_name")) {
    await d1.prepare("ALTER TABLE accessories ADD COLUMN market_name TEXT NOT NULL DEFAULT ''").run();
  }
  if (!columns.results.some((column) => column.name === "price_tokens")) {
    await d1.prepare("ALTER TABLE accessories ADD COLUMN price_tokens REAL").run();
  }

  const countRow = await d1.prepare("SELECT COUNT(*) AS count FROM accessories").first<{ count: number }>();
  if (Number(countRow?.count ?? 0) >= seedData.length) {
    const missingMarketNames = seedData
      .filter((item) => item.marketName)
      .map((item) => d1.prepare("UPDATE accessories SET market_name = ? WHERE id = ? AND market_name = ''")
        .bind(item.marketName, item.id));
    for (let offset = 0; offset < missingMarketNames.length; offset += 50) {
      await d1.batch(missingMarketNames.slice(offset, offset + 50));
    }
    return;
  }

  // D1 keeps SQLite's conservative bind-variable limit in local previews.
  // Four rows × 22 columns stays below that limit.
  const rowsPerStatement = 4;
  const statements: D1PreparedStatement[] = [];
  for (let offset = 0; offset < seedData.length; offset += rowsPerStatement) {
    const rows = seedData.slice(offset, offset + rowsPerStatement);
    const placeholders = rows.map(() => `(${INSERT_COLUMNS.map(() => "?").join(",")})`).join(",");
    const sql = `INSERT OR REPLACE INTO accessories (${INSERT_COLUMNS.join(",")}) VALUES ${placeholders}`;
    statements.push(d1.prepare(sql).bind(...rows.flatMap(seedValues)));
  }

  for (let offset = 0; offset < statements.length; offset += 10) {
    await d1.batch(statements.slice(offset, offset + 10));
  }
  await d1.prepare("PRAGMA optimize").run();
}

export async function ensureAccessoriesDatabase() {
  initialization ??= initializeDatabase().catch((error) => {
    initialization = null;
    throw error;
  });
  return initialization;
}

export async function listAccessories(options: {
  query?: string;
  category?: string;
  rarity?: string;
  limit: number;
  offset: number;
}) {
  await ensureAccessoriesDatabase();
  const d1 = getD1();
  const conditions: string[] = [];
  const bindings: Array<string | number> = [];

  if (options.query) {
    conditions.push("(name LIKE ? OR weapon_name LIKE ? OR pattern_name LIKE ?)");
    const search = `%${options.query}%`;
    bindings.push(search, search, search);
  }
  if (options.category) {
    conditions.push("category_name = ?");
    bindings.push(options.category);
  }
  if (options.rarity) {
    conditions.push("rarity_id = ?");
    bindings.push(options.rarity);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await d1
    .prepare(`SELECT COUNT(*) AS count FROM accessories ${where}`)
    .bind(...bindings)
    .first<{ count: number }>();
  const rows = await d1
    .prepare(`SELECT id, name, market_name AS marketName, description, weapon_id AS weaponId, weapon_name AS weaponName,
      category_id AS categoryId, category_name AS categoryName, pattern_name AS patternName,
      min_float AS minFloat, max_float AS maxFloat, rarity_id AS rarityId,
      rarity_name AS rarityName, rarity_color AS rarityColor, stattrak, souvenir,
      paint_index AS paintIndex, wears_json AS wearsJson, image_url AS imageUrl,
      price_cny AS priceCny, price_tokens AS priceTokens, price_source AS priceSource, source, source_url AS sourceUrl,
      updated_at AS updatedAt
      FROM accessories ${where}
      ORDER BY category_name, weapon_name, name
      LIMIT ? OFFSET ?`)
    .bind(...bindings, options.limit, options.offset)
    .all();

  return { total: Number(count?.count ?? 0), rows: rows.results };
}

export async function getAccessoryById(id: string) {
  await ensureAccessoriesDatabase();
  return getD1()
    .prepare(`SELECT id, name, market_name AS marketName, description, weapon_id AS weaponId, weapon_name AS weaponName,
      category_id AS categoryId, category_name AS categoryName, pattern_name AS patternName,
      min_float AS minFloat, max_float AS maxFloat, rarity_id AS rarityId,
      rarity_name AS rarityName, rarity_color AS rarityColor, stattrak, souvenir,
      paint_index AS paintIndex, wears_json AS wearsJson, image_url AS imageUrl,
      price_cny AS priceCny, price_tokens AS priceTokens, price_source AS priceSource, source, source_url AS sourceUrl,
      updated_at AS updatedAt
      FROM accessories WHERE id = ?`)
    .bind(id)
    .first();
}
