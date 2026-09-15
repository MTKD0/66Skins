import { env } from "cloudflare:workers";
import { boxes, type ClassicBox } from "@/app/classic-box/box-data";
import { CNY_PER_GAME_TOKEN, cnyToGameTokens } from "@/lib/economy";
import { calculateBalancedBoxPrice } from "@/lib/classic-box-economy";
import { ensureAccessoriesDatabase } from "./accessories";
import skinportSnapshot from "../data/market/skinport-cny.json";
import steamFallbackSnapshot from "../data/market/steam-fallback-cny.json";

const SKINPORT_SOURCE = "SKINPORT";
const STEAM_SOURCE = "STEAM";
const CSGODT_SOURCE = "CSGODT";
const SKINPORT_ENDPOINT = "https://api.skinport.com/v1/items?app_id=730&currency=CNY&tradable=0";
const CSGODT_ENDPOINT = "https://www.csgodt.com/anon/ornaments/findOrnamentsPage";
const SYNC_INTERVAL_MS = 48 * 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 15 * 60 * 1000;
const MAX_UNCONFIRMED_CHANGE = 0.35;
const CORROBORATION_TOLERANCE = 0.2;

export type PriceSyncState = {
  source: string;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  status: string;
  updatedCount: number;
  errorMessage: string | null;
};

type PriceCandidate = {
  box: ClassicBox;
  source: typeof SKINPORT_SOURCE | typeof CSGODT_SOURCE;
  sourceLabel: string;
  priceCny: number;
  quantity: number | null;
  observedAt: string;
  note: string;
};

type SkinportItem = {
  market_hash_name?: string;
  suggested_price?: number | null;
  min_price?: number | null;
  mean_price?: number | null;
  median_price?: number | null;
  quantity?: number | null;
  updated_at?: number | null;
};

type CsgodtPrice = {
  platform?: { name?: string; message?: string };
  sellPrice?: string | number;
};

type CsgodtItem = {
  marketName?: string;
  updateTime?: string;
  prices?: CsgodtPrice[];
};

type CsgodtResponse = {
  success?: boolean;
  message?: string;
  data?: { list?: CsgodtItem[] };
};

export type ClassicBoxMarketValue = {
  boxId: number;
  accessoryId: string;
  itemValue: number;
  priceCny: number | null;
  priceSource: string | null;
  priceUpdatedAt: string | null;
  exteriorName: string;
  boxPrice: number;
};

type AccessoryMarketRow = {
  id: string;
  marketName: string;
};

type SkinportVariant = {
  accessoryId: string;
  marketHashName: string;
  exteriorName: string | null;
  stattrak: boolean;
  souvenir: boolean;
  priceCny: number;
  priceTokens: number;
  suggestedPriceCny: number | null;
  quantity: number | null;
  observedAt: string;
  method: string;
};

type Evaluation = {
  candidate: PriceCandidate;
  accepted: boolean;
  reason: string;
};

type CurrentPrice = {
  priceCny: number | null;
  priceSource: string | null;
};

let priceDatabaseInitialization: Promise<void> | null = null;
let syncInFlight: Promise<void> | null = null;

function getD1() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable");
  return env.DB;
}

async function initializePriceDatabase() {
  await ensureAccessoriesDatabase();
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS price_sync_state (
      source TEXT PRIMARY KEY,
      last_attempt_at TEXT NOT NULL,
      last_success_at TEXT,
      status TEXT NOT NULL,
      updated_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS accessory_prices (
      accessory_id TEXT NOT NULL,
      source TEXT NOT NULL,
      price_cny REAL NOT NULL,
      quantity INTEGER,
      observed_at TEXT NOT NULL,
      accepted INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      PRIMARY KEY (accessory_id, source)
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS accessory_price_variants (
      accessory_id TEXT NOT NULL,
      market_hash_name TEXT NOT NULL,
      exterior_name TEXT,
      stattrak INTEGER NOT NULL DEFAULT 0,
      souvenir INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      price_cny REAL NOT NULL,
      price_tokens REAL NOT NULL,
      suggested_price_cny REAL,
      quantity INTEGER,
      observed_at TEXT NOT NULL,
      PRIMARY KEY (market_hash_name, source)
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_accessory_prices_observed ON accessory_prices(observed_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_price_variants_accessory ON accessory_price_variants(accessory_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_price_variants_observed ON accessory_price_variants(observed_at)"),
  ]);
}

async function ensurePriceDatabase() {
  priceDatabaseInitialization ??= initializePriceDatabase().catch((error) => {
    priceDatabaseInitialization = null;
    throw error;
  });
  return priceDatabaseInitialization;
}

async function readSyncState(source = SKINPORT_SOURCE) {
  await ensurePriceDatabase();
  return getD1().prepare(`SELECT source, last_attempt_at AS lastAttemptAt, last_success_at AS lastSuccessAt,
    status, updated_count AS updatedCount, error_message AS errorMessage
    FROM price_sync_state WHERE source = ?`).bind(source).first<PriceSyncState>();
}

function isRecent(value: string | null | undefined, interval: number) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && Date.now() - timestamp < interval;
}

function positiveNumber(...values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0) ?? null;
}

function sourceTimestamp(unixSeconds: number | null | undefined) {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return new Date().toISOString();
  const timestamp = new Date(unixSeconds * 1000);
  return Number.isNaN(timestamp.valueOf()) ? new Date().toISOString() : timestamp.toISOString();
}

async function setSyncRunning(source: string) {
  await getD1().prepare(`INSERT INTO price_sync_state
    (source, last_attempt_at, last_success_at, status, updated_count, error_message)
    VALUES (?, ?, NULL, 'running', 0, NULL)
    ON CONFLICT(source) DO UPDATE SET last_attempt_at = excluded.last_attempt_at,
      status = 'running', updated_count = 0, error_message = NULL`)
    .bind(source, new Date().toISOString()).run();
}

async function setSyncSuccess(source: string, updatedCount: number, message: string | null = null) {
  await getD1().prepare(`UPDATE price_sync_state SET last_success_at = ?, status = 'success',
    updated_count = ?, error_message = ? WHERE source = ?`)
    .bind(new Date().toISOString(), updatedCount, message, source).run();
}

async function setSyncError(source: string, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 300) : "未知同步错误";
  await getD1().prepare(`UPDATE price_sync_state SET status = 'error', error_message = ? WHERE source = ?`)
    .bind(message, source).run();
}

function skinportPrice(item: SkinportItem) {
  const median = positiveNumber(item.median_price);
  const mean = positiveNumber(item.mean_price);
  const minimum = positiveNumber(item.min_price);
  const suggested = positiveNumber(item.suggested_price);
  let priceCny = median ?? mean ?? minimum ?? suggested;
  let method = median != null ? "median_price"
    : mean != null ? "mean_price"
      : minimum != null ? "min_price" : "suggested_price";
  if (priceCny != null && suggested != null) {
    const deviation = Math.abs(priceCny - suggested) / suggested;
    const lowLiquidity = Number(item.quantity ?? 0) <= 2;
    if (deviation > (lowLiquidity ? 0.5 : 2)) {
      priceCny = suggested;
      method = "suggested_price:outlier_guard";
    }
  }
  return { priceCny, method, suggested };
}

async function fetchSkinportPayload() {
  try {
    const response = await fetch(SKINPORT_ENDPOINT, {
      headers: { accept: "application/json", "accept-encoding": "br" },
      signal: AbortSignal.timeout(40_000),
    });
    if (!response.ok) throw new Error(`Skinport HTTP ${response.status}`);
    const payload = await response.json() as SkinportItem[];
    if (!Array.isArray(payload)) throw new Error("Skinport 返回格式异常");
    return payload;
  } catch {
    const snapshotItems = skinportSnapshot.items as SkinportItem[];
    if (!Array.isArray(snapshotItems) || !snapshotItems.length) throw new Error("Skinport 在线接口与本地快照均不可用");
    return snapshotItems;
  }
}

async function fetchSkinportPrices(payload: SkinportItem[]): Promise<PriceCandidate[]> {
  const byName = new Map(payload.map((item) => [item.market_hash_name, item]));

  return boxes.flatMap((box) => {
    const item = byName.get(box.marketHashName);
    if (!item) return [];
    const { priceCny, method } = skinportPrice(item);
    if (priceCny == null) return [];
    return [{
      box,
      source: SKINPORT_SOURCE,
      sourceLabel: `${SKINPORT_SOURCE}:${method}`,
      priceCny,
      quantity: typeof item.quantity === "number" ? item.quantity : null,
      observedAt: sourceTimestamp(item.updated_at),
      note: method,
    }];
  });
}

const EXTERIOR_PATTERN = / \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;
const EXTERIOR_PRIORITY = new Map([
  ["Field-Tested", 0],
  ["Minimal Wear", 1],
  ["Factory New", 2],
  ["Well-Worn", 3],
  ["Battle-Scarred", 4],
]);

const snapshotItems = skinportSnapshot.items as SkinportItem[];

function parseMarketVariant(marketHashName: string) {
  const stattrak = marketHashName.startsWith("StatTrak™ ") || marketHashName.startsWith("★ StatTrak™ ");
  const souvenir = marketHashName.startsWith("Souvenir ");
  const normalized = marketHashName
    .replace(/^StatTrak™ /, "")
    .replace(/^★ StatTrak™ /, "★ ")
    .replace(/^Souvenir /, "");
  const exterior = normalized.match(EXTERIOR_PATTERN)?.[1] ?? null;
  return { baseName: normalized.replace(EXTERIOR_PATTERN, ""), exterior, stattrak, souvenir };
}

function snapshotVariantsForMarketName(accessoryId: string, marketName: string): SkinportVariant[] {
  if (!marketName) return [];
  const variants: SkinportVariant[] = [];
  for (const item of snapshotItems) {
    if (!item.market_hash_name) continue;
    const parsed = parseMarketVariant(item.market_hash_name);
    if (parsed.baseName !== marketName) continue;
    const { priceCny, method, suggested } = skinportPrice(item);
    if (priceCny == null) continue;
    variants.push({
      accessoryId,
      marketHashName: item.market_hash_name,
      exteriorName: parsed.exterior,
      stattrak: parsed.stattrak,
      souvenir: parsed.souvenir,
      priceCny,
      priceTokens: cnyToGameTokens(priceCny),
      suggestedPriceCny: suggested,
      quantity: typeof item.quantity === "number" ? item.quantity : null,
      observedAt: sourceTimestamp(item.updated_at),
      method,
    });
  }
  return variants;
}

function selectRepresentativeVariant(candidates: SkinportVariant[]) {
  const regular = candidates.filter((candidate) => !candidate.stattrak && !candidate.souvenir);
  const pool = regular.length ? regular : candidates;
  return [...pool].sort((left, right) => {
    const leftRank = left.exteriorName == null ? -1 : EXTERIOR_PRIORITY.get(left.exteriorName) ?? 9;
    const rightRank = right.exteriorName == null ? -1 : EXTERIOR_PRIORITY.get(right.exteriorName) ?? 9;
    return leftRank - rightRank || left.priceCny - right.priceCny;
  })[0] ?? null;
}

export function getSnapshotAccessoryPrice(marketName: string) {
  const selected = selectRepresentativeVariant(snapshotVariantsForMarketName("snapshot", marketName));
  if (!selected) return null;
  return {
    priceCny: selected.priceCny,
    priceTokens: selected.priceTokens,
    priceSource: `${SKINPORT_SOURCE}:snapshot:${selected.method}:${selected.exteriorName ?? "base"}`,
    updatedAt: selected.observedAt,
  };
}

async function syncAllSkinportAccessories(payload: SkinportItem[]) {
  const d1 = getD1();
  const rows = await d1.prepare("SELECT id, market_name AS marketName FROM accessories WHERE market_name <> ''")
    .all<AccessoryMarketRow>();
  const byMarketName = new Map<string, string[]>();
  rows.results.forEach((row) => {
    const ids = byMarketName.get(row.marketName) ?? [];
    ids.push(row.id);
    byMarketName.set(row.marketName, ids);
  });
  const variants: SkinportVariant[] = [];

  for (const item of payload) {
    if (!item.market_hash_name) continue;
    const marketHashName = item.market_hash_name;
    const parsed = parseMarketVariant(item.market_hash_name);
    const accessoryIds = byMarketName.get(parsed.baseName);
    if (!accessoryIds?.length) continue;
    const { priceCny, method, suggested } = skinportPrice(item);
    if (priceCny == null) continue;
    accessoryIds.forEach((accessoryId) => variants.push({
        accessoryId,
        marketHashName,
        exteriorName: parsed.exterior,
        stattrak: parsed.stattrak,
        souvenir: parsed.souvenir,
        priceCny,
        priceTokens: cnyToGameTokens(priceCny),
        suggestedPriceCny: suggested,
        quantity: typeof item.quantity === "number" ? item.quantity : null,
        observedAt: sourceTimestamp(item.updated_at),
        method,
      }));
  }

  const variantStatements = variants.map((variant) => d1.prepare(`INSERT INTO accessory_price_variants
    (accessory_id, market_hash_name, exterior_name, stattrak, souvenir, source,
      price_cny, price_tokens, suggested_price_cny, quantity, observed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(market_hash_name, source) DO UPDATE SET accessory_id = excluded.accessory_id,
      exterior_name = excluded.exterior_name, stattrak = excluded.stattrak, souvenir = excluded.souvenir,
      price_cny = excluded.price_cny, price_tokens = excluded.price_tokens,
      suggested_price_cny = excluded.suggested_price_cny, quantity = excluded.quantity,
      observed_at = excluded.observed_at`)
    .bind(variant.accessoryId, variant.marketHashName, variant.exteriorName, variant.stattrak ? 1 : 0,
      variant.souvenir ? 1 : 0, SKINPORT_SOURCE, variant.priceCny, variant.priceTokens,
      variant.suggestedPriceCny, variant.quantity, variant.observedAt));
  for (let offset = 0; offset < variantStatements.length; offset += 50) {
    await d1.batch(variantStatements.slice(offset, offset + 50));
  }

  const grouped = new Map<string, SkinportVariant[]>();
  variants.forEach((variant) => {
    const group = grouped.get(variant.accessoryId) ?? [];
    group.push(variant);
    grouped.set(variant.accessoryId, group);
  });
  const aggregateStatements = Array.from(grouped.entries()).map(([accessoryId, candidates]) => {
    const regular = candidates.filter((candidate) => !candidate.stattrak && !candidate.souvenir);
    const pool = regular.length ? regular : candidates;
    const selected = [...pool].sort((left, right) => {
      const leftRank = left.exteriorName == null ? -1 : EXTERIOR_PRIORITY.get(left.exteriorName) ?? 9;
      const rightRank = right.exteriorName == null ? -1 : EXTERIOR_PRIORITY.get(right.exteriorName) ?? 9;
      return leftRank - rightRank || left.priceCny - right.priceCny;
    })[0];
    return d1.prepare(`UPDATE accessories SET price_cny = ?, price_tokens = ?, price_source = ?, updated_at = ? WHERE id = ?`)
      .bind(selected.priceCny, selected.priceTokens, `${SKINPORT_SOURCE}:${selected.method}:${selected.exteriorName ?? "base"}`,
        selected.observedAt, accessoryId);
  });
  for (let offset = 0; offset < aggregateStatements.length; offset += 50) {
    await d1.batch(aggregateStatements.slice(offset, offset + 50));
  }
  return { variantCount: new Set(variants.map((variant) => variant.marketHashName)).size, accessoryCount: grouped.size };
}

async function syncSteamFallbackPrices() {
  const d1 = getD1();
  const items = steamFallbackSnapshot.items.filter((item) => Number.isFinite(item.priceCny) && item.priceCny > 0);
  const statements = items.flatMap((item) => {
    const priceTokens = cnyToGameTokens(item.priceCny);
    return [
      d1.prepare(`INSERT INTO accessory_price_variants
        (accessory_id, market_hash_name, exterior_name, stattrak, souvenir, source,
          price_cny, price_tokens, suggested_price_cny, quantity, observed_at)
        VALUES (?, ?, NULL, 0, 0, ?, ?, ?, NULL, NULL, ?)
        ON CONFLICT(market_hash_name, source) DO UPDATE SET accessory_id = excluded.accessory_id,
          price_cny = excluded.price_cny, price_tokens = excluded.price_tokens, observed_at = excluded.observed_at`)
        .bind(item.accessoryId, item.marketHashName, STEAM_SOURCE, item.priceCny, priceTokens, item.observedAt),
      d1.prepare(`UPDATE accessories SET price_cny = ?, price_tokens = ?, price_source = ?, updated_at = ?
        WHERE id = ? AND (price_cny IS NULL OR price_source LIKE 'STEAM:%')`)
        .bind(item.priceCny, priceTokens, `${STEAM_SOURCE}:priceoverview`, item.observedAt, item.accessoryId),
    ];
  });
  for (let offset = 0; offset < statements.length; offset += 50) {
    await d1.batch(statements.slice(offset, offset + 50));
  }
  return items.length;
}

function pickCsgodtListing(item: CsgodtItem) {
  const listings = (item.prices ?? [])
    .map((entry) => ({
      price: Number(entry.sellPrice),
      platform: entry.platform?.message || entry.platform?.name || "公开市场",
    }))
    .filter((entry) => Number.isFinite(entry.price) && entry.price > 0);
  return listings.sort((left, right) => left.price - right.price)[0] ?? null;
}

async function fetchCsgodtPrice(box: ClassicBox): Promise<PriceCandidate | null> {
  const marketSearchName = box.marketSearchName || box.weaponName;
  const response = await fetch(CSGODT_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      page: 1,
      pageSize: 20,
      marketName: marketSearchName,
      exteriorName: box.preferredExterior,
      rarityName: "",
      typeName: "",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`CSGODT HTTP ${response.status}`);
  const payload = await response.json() as CsgodtResponse;
  if (!payload.success) throw new Error(payload.message || "CSGODT 返回失败");
  const expectedName = `${marketSearchName} (${box.preferredExterior})`;
  const item = (payload.data?.list ?? []).find((entry) => entry.marketName === expectedName)
    ?? (payload.data?.list ?? []).find((entry) => entry.marketName?.startsWith(`${marketSearchName} (`) && !entry.marketName.includes("StatTrak"));
  const listing = item ? pickCsgodtListing(item) : null;
  if (!item || !listing) return null;
  return {
    box,
    source: CSGODT_SOURCE,
    sourceLabel: `${CSGODT_SOURCE}:${listing.platform}`,
    priceCny: listing.price,
    quantity: null,
    observedAt: item.updateTime || new Date().toISOString(),
    note: `lowest:${listing.platform}`,
  };
}

async function fetchCsgodtPrices(targetBoxes: ClassicBox[]) {
  const results: Array<PriceCandidate | null> = [];
  for (let offset = 0; offset < targetBoxes.length; offset += 5) {
    results.push(...await Promise.all(targetBoxes.slice(offset, offset + 5).map(fetchCsgodtPrice)));
  }
  return results.filter((result): result is PriceCandidate => Boolean(result));
}

async function readCurrentPrices() {
  const ids = boxes.map((box) => box.accessoryId);
  const placeholders = ids.map(() => "?").join(",");
  const rows = await getD1().prepare(`SELECT id, price_cny AS priceCny, price_source AS priceSource FROM accessories
    WHERE id IN (${placeholders})`).bind(...ids).all<{ id: string; priceCny: number | null; priceSource: string | null }>();
  return new Map(rows.results.map((row) => [row.id, {
    priceCny: row.priceCny == null ? null : Number(row.priceCny),
    priceSource: row.priceSource,
  }]));
}

function relativeChange(candidate: number, reference: number) {
  return Math.abs(candidate - reference) / reference;
}

function evaluateCandidates(
  candidates: PriceCandidate[],
  currentPrices: Map<string, CurrentPrice>,
  corroboration: Map<string, PriceCandidate> = new Map(),
): Evaluation[] {
  return candidates.map((candidate) => {
    const current = currentPrices.get(candidate.box.accessoryId);
    if (candidate.source === SKINPORT_SOURCE && !current?.priceSource?.startsWith(`${SKINPORT_SOURCE}:`)) {
      return { candidate, accepted: true, reason: `${candidate.note};initial-source-baseline` };
    }
    if (current?.priceCny == null || current.priceCny <= 0
      || relativeChange(candidate.priceCny, current.priceCny) <= MAX_UNCONFIRMED_CHANGE) {
      return { candidate, accepted: true, reason: candidate.note };
    }
    const backup = corroboration.get(candidate.box.accessoryId);
    if (backup && relativeChange(candidate.priceCny, backup.priceCny) <= CORROBORATION_TOLERANCE) {
      return { candidate, accepted: true, reason: `${candidate.note};corroborated:${backup.sourceLabel}` };
    }
    return {
      candidate,
      accepted: false,
      reason: `${candidate.note};blocked-change:${Math.round(relativeChange(candidate.priceCny, current.priceCny) * 100)}%`,
    };
  });
}

async function saveEvaluations(evaluations: Evaluation[]) {
  const d1 = getD1();
  const statements = evaluations.map(({ candidate, accepted, reason }) => d1.prepare(`INSERT INTO accessory_prices
    (accessory_id, source, price_cny, quantity, observed_at, accepted, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(accessory_id, source) DO UPDATE SET price_cny = excluded.price_cny,
      quantity = excluded.quantity, observed_at = excluded.observed_at,
      accepted = excluded.accepted, note = excluded.note`)
    .bind(candidate.box.accessoryId, candidate.source, candidate.priceCny, candidate.quantity,
      candidate.observedAt, accepted ? 1 : 0, reason));
  for (let offset = 0; offset < statements.length; offset += 10) {
    await d1.batch(statements.slice(offset, offset + 10));
  }
}

async function applyAccepted(evaluations: Evaluation[]) {
  const d1 = getD1();
  const accepted = evaluations.filter((result) => result.accepted);
  const statements = accepted.map(({ candidate }) => d1.prepare(`UPDATE accessories
    SET price_cny = ?, price_tokens = ?, price_source = ?, updated_at = ? WHERE id = ?`)
    .bind(candidate.priceCny, cnyToGameTokens(candidate.priceCny), candidate.sourceLabel,
      candidate.observedAt, candidate.box.accessoryId));
  for (let offset = 0; offset < statements.length; offset += 10) {
    await d1.batch(statements.slice(offset, offset + 10));
  }
  return accepted.length;
}

async function syncCsgodtFallback(currentPrices: Map<string, CurrentPrice>, cause: unknown) {
  await setSyncRunning(CSGODT_SOURCE);
  try {
    const candidates = await fetchCsgodtPrices(boxes);
    if (!candidates.length) throw new Error("CSGODT 未返回可匹配的箱子饰品价格");
    const evaluations = evaluateCandidates(candidates, currentPrices);
    await saveEvaluations(evaluations);
    const acceptedCount = await applyAccepted(evaluations);
    const blockedCount = evaluations.length - acceptedCount;
    await setSyncSuccess(CSGODT_SOURCE, acceptedCount,
      blockedCount ? `${blockedCount} 件价格变化过大，已保留旧价格` : `Skinport 不可用：${cause instanceof Error ? cause.message : "未知错误"}`);
  } catch (error) {
    await setSyncError(CSGODT_SOURCE, error);
    throw error;
  }
}

async function performMarketPriceSync() {
  await ensurePriceDatabase();
  const currentPrices = await readCurrentPrices();
  await setSyncRunning(SKINPORT_SOURCE);

  try {
    const payload = await fetchSkinportPayload();
    const steamFallbackCount = await syncSteamFallbackPrices();
    const candidates = await fetchSkinportPrices(payload);
    if (!candidates.length) throw new Error("Skinport 未返回可匹配的箱子饰品价格");

    const anomalyBoxes = candidates
      .filter((candidate) => {
        const current = currentPrices.get(candidate.box.accessoryId);
        return current?.priceSource?.startsWith(`${SKINPORT_SOURCE}:`) && current.priceCny != null
          && current.priceCny > 0 && relativeChange(candidate.priceCny, current.priceCny) > MAX_UNCONFIRMED_CHANGE;
      })
      .map((candidate) => candidate.box);
    const corroboration = new Map<string, PriceCandidate>();

    if (anomalyBoxes.length) {
      await setSyncRunning(CSGODT_SOURCE);
      try {
        const backupCandidates = await fetchCsgodtPrices(anomalyBoxes);
        await saveEvaluations(backupCandidates.map((candidate) => ({
          candidate,
          accepted: false,
          reason: `${candidate.note};validation-only`,
        })));
        backupCandidates.forEach((candidate) => corroboration.set(candidate.box.accessoryId, candidate));
        await setSyncSuccess(CSGODT_SOURCE, backupCandidates.length, "Skinport 异常价格复核");
      } catch (error) {
        await setSyncError(CSGODT_SOURCE, error);
      }
    }

    const evaluations = evaluateCandidates(candidates, currentPrices, corroboration);
    await saveEvaluations(evaluations);
    const acceptedCount = await applyAccepted(evaluations);
    const blockedCount = evaluations.length - acceptedCount;
    const summary = `已更新 ${acceptedCount} 个箱子价格；完整饰品价格由发布快照按需读取${steamFallbackCount ? `，另写入 ${steamFallbackCount} 个 Steam 后备价格` : ""}`;
    await setSyncSuccess(SKINPORT_SOURCE, acceptedCount + steamFallbackCount,
      blockedCount ? `${summary}；${blockedCount} 件箱子价格变化过大且未获备用源确认` : summary);
    await getD1().prepare("PRAGMA optimize").run();
  } catch (error) {
    await setSyncError(SKINPORT_SOURCE, error);
    await syncCsgodtFallback(currentPrices, error);
  }
}

export async function maybeSyncMarketPrices(force = false) {
  const state = await readSyncState(SKINPORT_SOURCE);
  if (!force && (isRecent(state?.lastSuccessAt, SYNC_INTERVAL_MS) || isRecent(state?.lastAttemptAt, RETRY_INTERVAL_MS))) {
    return state;
  }
  syncInFlight ??= performMarketPriceSync().finally(() => { syncInFlight = null; });
  try {
    await syncInFlight;
  } catch {
    // Keep serving the previous successful values when both external sources are unavailable.
  }
  return await readSyncState(SKINPORT_SOURCE) ?? await readSyncState(CSGODT_SOURCE);
}

export async function getClassicBoxMarketValues(options: { sync?: boolean; databaseOnly?: boolean } = {}) {
  await ensurePriceDatabase();
  const syncState = options.sync === false
    ? await readSyncState(SKINPORT_SOURCE) ?? await readSyncState(CSGODT_SOURCE)
    : await maybeSyncMarketPrices();
  const ids = boxes.map((box) => box.accessoryId);
  const placeholders = ids.map(() => "?").join(",");
  const result = await getD1().prepare(`SELECT id, price_cny AS priceCny, price_tokens AS priceTokens, price_source AS priceSource,
    updated_at AS priceUpdatedAt FROM accessories WHERE id IN (${placeholders})`).bind(...ids).all<{
      id: string;
      priceCny: number | null;
      priceTokens: number | null;
      priceSource: string | null;
      priceUpdatedAt: string | null;
    }>();
  const byId = new Map(result.results.map((row) => [row.id, row]));
  const marketHashes = boxes.map((box) => box.marketHashName);
  const hashPlaceholders = marketHashes.map(() => "?").join(",");
  const variants = await getD1().prepare(`SELECT market_hash_name AS marketHashName, price_cny AS priceCny,
    price_tokens AS priceTokens, source, observed_at AS observedAt FROM accessory_price_variants
    WHERE market_hash_name IN (${hashPlaceholders}) AND source = ?`)
    .bind(...marketHashes, SKINPORT_SOURCE).all<{
      marketHashName: string;
      priceCny: number;
      priceTokens: number;
      source: string;
      observedAt: string;
    }>();
  const byMarketHash = new Map(variants.results.map((row) => [row.marketHashName, row]));
  const baseValues = boxes.map((box) => {
    const row = byId.get(box.accessoryId);
    const variant = byMarketHash.get(box.marketHashName);
    const priceCny = variant?.priceCny
      ?? (row?.priceCny == null ? null : Number(row.priceCny))
      ?? null;
    return {
      boxId: box.id,
      accessoryId: box.accessoryId,
      itemValue: priceCny != null && priceCny > 0 ? cnyToGameTokens(priceCny) : 0,
      priceCny,
      priceSource: variant
        ? `${SKINPORT_SOURCE}:variant`
        : row?.priceSource ?? null,
      priceUpdatedAt: variant?.observedAt
        ?? row?.priceUpdatedAt ?? null,
      exteriorName: box.preferredExterior,
      boxPrice: 0,
    };
  });
  const valueByBoxId = new Map(baseValues.map((value) => [value.boxId, value.itemValue]));
  const values: ClassicBoxMarketValue[] = baseValues.map((value) => {
    const start = Math.max(0, value.boxId - 1);
    const poolValues = Array.from({ length: 10 }, (_, index) => {
      const poolBox = boxes[(start + index) % boxes.length];
      return valueByBoxId.get(poolBox.id) ?? 0;
    });
    return { ...value, boxPrice: poolValues.every(price => Number.isFinite(price) && price > 0) ? calculateBalancedBoxPrice(poolValues) : 0 };
  });
  return { values, syncState, exchangeRate: CNY_PER_GAME_TOKEN };
}

export async function getAccessoryMarketVariants(accessoryId: string, options: {databaseOnly?: boolean} = {}) {
  await ensurePriceDatabase();
  const d1 = getD1();
  const result = await d1.prepare(`SELECT market_hash_name AS marketHashName, exterior_name AS exteriorName,
    stattrak, souvenir, source, price_cny AS priceCny, price_tokens AS priceTokens,
    suggested_price_cny AS suggestedPriceCny, quantity, observed_at AS observedAt
    FROM accessory_price_variants WHERE accessory_id = ?
    ORDER BY stattrak ASC, souvenir ASC, price_tokens ASC`)
    .bind(accessoryId)
    .all<{
      marketHashName: string;
      exteriorName: string | null;
      stattrak: number;
      souvenir: number;
      source: string;
      priceCny: number;
      priceTokens: number;
      suggestedPriceCny: number | null;
      quantity: number | null;
      observedAt: string;
    }>();

  const databaseVariants = result.results.map((row) => ({
    ...row,
    stattrak: Boolean(row.stattrak),
    souvenir: Boolean(row.souvenir),
    priceCny: Number(row.priceCny),
    priceTokens: cnyToGameTokens(Number(row.priceCny)),
  }));
  if (options.databaseOnly) return databaseVariants;
  const accessory = await d1.prepare("SELECT market_name AS marketName FROM accessories WHERE id = ?")
    .bind(accessoryId)
    .first<{ marketName: string }>();
  const snapshotVariants = snapshotVariantsForMarketName(accessoryId, accessory?.marketName ?? "").map((variant) => ({
    marketHashName: variant.marketHashName,
    exteriorName: variant.exteriorName,
    stattrak: variant.stattrak,
    souvenir: variant.souvenir,
    source: SKINPORT_SOURCE,
    priceCny: variant.priceCny,
    priceTokens: variant.priceTokens,
    suggestedPriceCny: variant.suggestedPriceCny,
    quantity: variant.quantity,
    observedAt: variant.observedAt,
  }));
  const merged = new Map(databaseVariants.map((variant) => [`${variant.source}:${variant.marketHashName}`, variant]));
  snapshotVariants.forEach((variant) => merged.set(`${variant.source}:${variant.marketHashName}`, variant));
  return Array.from(merged.values()).sort((left, right) => Number(left.stattrak) - Number(right.stattrak)
    || Number(left.souvenir) - Number(right.souvenir)
    || (EXTERIOR_PRIORITY.get(left.exteriorName ?? "") ?? 9) - (EXTERIOR_PRIORITY.get(right.exteriorName ?? "") ?? 9)
    || left.priceTokens - right.priceTokens);
}
