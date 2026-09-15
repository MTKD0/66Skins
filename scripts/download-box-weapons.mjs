import fs from "node:fs";
import path from "node:path";

const selections = [
  "P90 | 冷血杀手",
  "SSG 08 | 碧蓝雕文",
  "USP消音版 | 蓝图",
  "沙漠之鹰 | 钴蓝禁锢",
  "MP9 | 钴蓝佩斯利",
  "M4A4 | 钢铁红流",
  "AK-47 | 红线",
  "AWP | 红线",
  "M4A1消音版 | 赤红新星",
  "格洛克18型 | 红苹果",
  "AUG | 璞玉",
  "UMP-45 | 忘忧草",
  "法玛斯 | 雅典娜之眼",
  "新星 | 绿苹果",
  "蝴蝶刀（★） | 伽玛多普勒",
];

const projectRoot = process.cwd();
const seed = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "accessories.seed.json"), "utf8"));
const outputDir = path.join(projectRoot, "public", "assets", "classic-box", "weapons");
fs.mkdirSync(outputDir, { recursive: true });

const manifest = [];
for (const [index, name] of selections.entries()) {
  const item = seed.find((candidate) => candidate.name === name);
  if (!item) throw new Error(`Accessory not found: ${name}`);

  const filename = `weapon-${String(index + 1).padStart(2, "0")}.png`;
  const response = await fetch(item.imageUrl);
  if (!response.ok) throw new Error(`Download failed for ${name}: ${response.status}`);
  fs.writeFileSync(path.join(outputDir, filename), Buffer.from(await response.arrayBuffer()));
  manifest.push({
    boxId: index + 1,
    accessoryId: item.id,
    name: item.name,
    rarityColor: item.rarityColor,
    src: `/assets/classic-box/weapons/${filename}`,
    sourceUrl: item.imageUrl,
  });
  console.log(`Downloaded ${index + 1}/${selections.length}: ${name}`);
}

fs.writeFileSync(path.join(projectRoot, "data", "classic-box-weapons.json"), JSON.stringify(manifest, null, 2));
