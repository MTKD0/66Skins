import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const skinportPath = path.join(projectRoot, "data", "market", "skinport-cny.json");
const englishPath = path.join(projectRoot, "data", "source", "skins.en.json");
const outputPath = path.join(projectRoot, "data", "market", "steam-fallback-cny.json");
const intervalMs = 48 * 60 * 60 * 1000;
const forced = process.argv.includes("--force");
const exteriorPattern = / \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;

if (!forced && fs.existsSync(outputPath)) {
  try {
    const current = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const fetchedAt = Date.parse(current.fetchedAt ?? "");
    if (Number.isFinite(fetchedAt) && Date.now() - fetchedAt < intervalMs) {
      console.log(`Steam 后备价格仍在两天有效期内：${current.items?.length ?? 0} 条`);
      process.exit(0);
    }
  } catch {
    // Invalid snapshots are replaced below.
  }
}

const skinport = JSON.parse(fs.readFileSync(skinportPath, "utf8")).items;
const english = JSON.parse(fs.readFileSync(englishPath, "utf8"));
const pricedMarketNames = new Set(skinport.filter((item) => {
  const prices = [item.median_price, item.mean_price, item.min_price, item.suggested_price];
  return prices.some((value) => Number.isFinite(value) && value > 0);
}).map((item) => String(item.market_hash_name ?? "")
  .replace(/^StatTrak™ /, "")
  .replace(/^★ StatTrak™ /, "★ ")
  .replace(/^Souvenir /, "")
  .replace(exteriorPattern, "")));

const missing = english.filter((item) => item?.id && item?.name && !pricedMarketNames.has(String(item.name)));
const preferredWears = ["Field-Tested", "Minimal Wear", "Factory New", "Well-Worn", "Battle-Scarred"];
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function parseCny(value) {
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").match(/[0-9]+(?:\.[0-9]+)?/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function querySteam(marketHashName) {
  const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=23&market_hash_name=${encodeURIComponent(marketHashName)}`;
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0 66skins-local" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return null;
  const payload = await response.json();
  if (!payload.success) return null;
  const priceCny = parseCny(payload.median_price) ?? parseCny(payload.lowest_price);
  return priceCny == null ? null : { priceCny, volume: payload.volume ?? null };
}

const results = [];
for (const item of missing) {
  const wears = Array.isArray(item.wears) ? item.wears.map((wear) => wear.name) : [];
  const orderedWears = preferredWears.filter((wear) => wears.includes(wear));
  const baseCandidates = orderedWears.length ? orderedWears.map((wear) => `${item.name} (${wear})`) : [item.name];
  const candidates = [
    ...baseCandidates,
    ...(item.souvenir ? baseCandidates.map((name) => `Souvenir ${name}`) : []),
    ...(item.stattrak ? baseCandidates.map((name) => name.startsWith("★ ") ? name.replace("★ ", "★ StatTrak™ ") : `StatTrak™ ${name}`) : []),
  ];
  let matched = null;
  for (const marketHashName of candidates) {
    matched = await querySteam(marketHashName);
    await wait(700);
    if (matched) {
      results.push({ accessoryId: String(item.id), marketHashName, ...matched, observedAt: new Date().toISOString() });
      break;
    }
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
fs.writeFileSync(temporaryPath, JSON.stringify({ fetchedAt: new Date().toISOString(), items: results }));
fs.renameSync(temporaryPath, outputPath);
console.log(`已更新 Steam 后备价格：${results.length}/${missing.length} 条`);
