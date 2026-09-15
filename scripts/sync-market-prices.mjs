import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const outputPath = path.join(projectRoot, "data", "market", "skinport-cny.json");
const endpoint = "https://api.skinport.com/v1/items?app_id=730&currency=CNY&tradable=0";
const intervalMs = 48 * 60 * 60 * 1000;
const forced = process.argv.includes("--force");

if (!forced && fs.existsSync(outputPath)) {
  try {
    const current = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const fetchedAt = Date.parse(current.fetchedAt ?? "");
    if (Number.isFinite(fetchedAt) && Date.now() - fetchedAt < intervalMs) {
      console.log(`Skinport 价格快照仍在两天有效期内：${current.items?.length ?? 0} 条`);
      process.exit(0);
    }
  } catch {
    // Invalid snapshots are replaced below.
  }
}

const response = await fetch(endpoint, {
  headers: { accept: "application/json", "accept-encoding": "br" },
  signal: AbortSignal.timeout(45_000),
});
if (!response.ok) throw new Error(`Skinport HTTP ${response.status}`);
const items = await response.json();
if (!Array.isArray(items) || items.length < 1000) throw new Error("Skinport 价格快照格式异常");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
fs.writeFileSync(temporaryPath, JSON.stringify({ fetchedAt: new Date().toISOString(), items }));
fs.renameSync(temporaryPath, outputPath);
console.log(`已更新 Skinport CNY 价格快照：${items.length} 条`);
