import { gameDB, GameError } from "./game-auth";
import { ensureAccessoriesDatabase } from "./accessories";
import { CNY_PER_GAME_TOKEN } from "@/lib/economy";

const categoryNames: Record<string, string> = {
  glove: "手套", knife: "匕首", pistol: "手枪", smg: "微型冲锋枪",
  rifle: "步枪", sniper: "步枪", ultimate: "重型武器",
};
const sniperIds = ["weapon_awp", "weapon_ssg08", "weapon_g3sg1", "weapon_scar20"];
export type LuckyAccessory = { id: string; name: string; weaponName: string; categoryName: string; imageUrl: string; priceTokens: number | null };

export async function listLuckyAccessories(params: URLSearchParams) {
  await ensureAccessoriesDatabase();
  const category = params.get("category") || "recommend";
  if (category !== "recommend" && !Object.hasOwn(categoryNames, category)) throw new GameError("无效品类");
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];
  if (category !== "recommend") {
    conditions.push("category_name = ?"); bindings.push(categoryNames[category]);
  }
  if (category === "rifle" || category === "sniper") {
    conditions.push(`weapon_id ${category === "rifle" ? "NOT IN" : "IN"} (?,?,?,?)`);
    bindings.push(...sniperIds);
  }
  const categoryWhere = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const types = await gameDB().prepare(`SELECT DISTINCT weapon_name AS name FROM accessories ${categoryWhere} ORDER BY weapon_name`).bind(...bindings).all<{name:string}>();
  const weapon = params.get("weapon")?.trim();
  if (weapon) { conditions.push("weapon_name = ?"); bindings.push(weapon); }
  const query = params.get("q")?.trim().slice(0, 80);
  if (query) {
    conditions.push("(name LIKE ? ESCAPE '\\' OR market_name LIKE ? ESCAPE '\\')");
    const search = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    bindings.push(search, search);
  }
  // One canonical conversion for filtering, ordering and the displayed price.
  const value = `CASE WHEN price_cny > 0 AND price_source IS NOT NULL THEN ROUND(price_cny / ${CNY_PER_GAME_TOKEN}, 2) ELSE NULL END`;
  const parsePrice = (key: string) => {
    const raw = params.get(key);
    if (!raw?.trim()) return null;
    const result = Number(raw);
    if (!Number.isFinite(result) || result < 0) throw new GameError("价格必须是非负数字");
    return result;
  };
  const min = parsePrice("min"), max = parsePrice("max");
  if (min !== null && max !== null && min > max) throw new GameError("最低价格不能高于最高价格");
  if (min !== null) { conditions.push(`${value} >= ?`); bindings.push(min); }
  if (max !== null) { conditions.push(`${value} <= ?`); bindings.push(max); }
  const rawPage = Number(params.get("page") ?? 0);
  if (!Number.isInteger(rawPage) || rawPage < 0 || rawPage > 10000) throw new GameError("无效页码");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await gameDB().prepare(`SELECT COUNT(*) AS total FROM accessories ${where}`).bind(...bindings).first<{total:number}>();
  const total = count?.total ?? 0, pageSize = 20;
  const page = Math.min(rawPage, Math.max(0, Math.ceil(total / pageSize) - 1));
  const direction = params.get("sort") === "desc" ? "DESC" : "ASC";
  const rows = await gameDB().prepare(`SELECT id, name, weapon_name AS weaponName, category_name AS categoryName,
    image_url AS imageUrl, ${value} AS priceTokens FROM accessories ${where}
    ORDER BY (${value}) IS NULL, (${value}) ${direction}, name, id LIMIT ? OFFSET ?`)
    .bind(...bindings, pageSize, page * pageSize).all<LuckyAccessory>();
  return { rows: rows.results, total, page, pageSize, types: types.results.map(row => row.name) };
}
