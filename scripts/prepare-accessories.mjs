import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, "data", "source", "skins.zh-CN.json");
const englishSourcePath = path.join(projectRoot, "data", "source", "skins.en.json");
const outputPath = path.join(projectRoot, "data", "accessories.seed.json");
const sourceUrl = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/zh-CN/skins.json";

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const englishSource = JSON.parse(fs.readFileSync(englishSourcePath, "utf8"));
const englishById = new Map(englishSource.map((item) => [String(item.id), item]));
const accessories = source
  .filter((item) => item?.id && item?.name && item?.image)
  .map((item) => {
    const english = englishById.get(String(item.id));
    return {
    id: String(item.id),
    name: String(item.name),
    marketName: String(english?.name ?? ""),
    description: String(item.description ?? ""),
    weaponId: String(item.weapon?.id ?? "unknown"),
    weaponName: String(item.weapon?.name ?? "未知武器"),
    categoryId: String(item.category?.id ?? "unknown"),
    categoryName: String(item.category?.name ?? "其他"),
    patternName: String(item.pattern?.name ?? ""),
    minFloat: typeof item.min_float === "number" ? item.min_float : null,
    maxFloat: typeof item.max_float === "number" ? item.max_float : null,
    rarityId: String(item.rarity?.id ?? "unknown"),
    rarityName: String(item.rarity?.name ?? "未知品质"),
    rarityColor: String(item.rarity?.color ?? "#b0c3d9"),
    stattrak: Boolean(item.stattrak),
    souvenir: Boolean(item.souvenir),
    paintIndex: item.paint_index == null ? null : String(item.paint_index),
    wears: Array.isArray(item.wears) ? item.wears.map((wear) => String(wear.name)) : [],
    imageUrl: String(item.image),
    source: "ByMykel/CSGO-API",
    sourceUrl,
  }; })
  .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

fs.writeFileSync(outputPath, JSON.stringify(accessories));
console.log(`Prepared ${accessories.length} accessories at ${outputPath}`);
