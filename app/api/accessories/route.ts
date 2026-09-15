import { getAccessoryById, listAccessories } from "@/db/accessories";
import { getAccessoryMarketVariants, getSnapshotAccessoryPrice, maybeSyncMarketPrices } from "@/db/prices";
import { CNY_PER_GAME_TOKEN, cnyToGameTokens } from "@/lib/economy";

function parsePositiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : fallback;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const databaseOnly = url.searchParams.get("databaseOnly") === "1";
    const priceSync = databaseOnly ? null : await maybeSyncMarketPrices();
    const id = url.searchParams.get("id")?.trim();
    if (id) {
      const item = await getAccessoryById(id);
      if (!item) return Response.json({ error: "未找到饰品" }, { status: 404 });
      const variants = url.searchParams.get("variants") === "1"
        ? await getAccessoryMarketVariants(id, {databaseOnly})
        : [];
      const snapshotPrice = databaseOnly ? null : getSnapshotAccessoryPrice(String(item.marketName ?? ""));
      return Response.json({
        item: databaseOnly ? {...item,priceTokens:item.priceSource && Number(item.priceCny)>0?cnyToGameTokens(Number(item.priceCny)):null} : snapshotPrice && !(Number(item.priceTokens) > 0)
          ? { ...item, ...snapshotPrice }
          : item,
        variants,
        priceSource: priceSync?.source ?? "SKINPORT",
        priceSync,
        cnyPerGameToken: CNY_PER_GAME_TOKEN,
      });
    }
    const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 100);
    const offset = parsePositiveInteger(url.searchParams.get("offset"), 0, 100_000);
    const query = url.searchParams.get("q")?.trim().slice(0, 80) || undefined;
    const category = url.searchParams.get("category")?.trim().slice(0, 80) || undefined;
    const rarity = url.searchParams.get("rarity")?.trim().slice(0, 80) || undefined;
    const result = await listAccessories({ query, category, rarity, limit, offset });
    const rows = result.rows.map((item) => {
      const snapshotPrice = getSnapshotAccessoryPrice(String(item.marketName ?? ""));
      return snapshotPrice && !(Number(item.priceTokens) > 0)
        ? { ...item, ...snapshotPrice }
        : item;
    });

    return Response.json({
      ...result,
      rows,
      limit,
      offset,
      source: "ByMykel/CSGO-API",
      priceSource: priceSync?.source ?? "SKINPORT",
      priceSync,
      cnyPerGameToken: CNY_PER_GAME_TOKEN,
      sourceUpdatedAt: "2026-08-16T00:00:00.000Z",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "饰品数据库读取失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
