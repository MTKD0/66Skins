import { boxAssets, boxes } from "@/app/classic-box/box-data";
import { currentUser } from "@/db/game-auth";
import { addRecentDrops, listRecentDrops, type RecentDropRecord } from "@/db/recent-drops";

type ItemTone = RecentDropRecord["rarity"];

function getTone(index: number, total: number): ItemTone {
  const goldCount = Math.max(1, Math.round(total * 0.1));
  const redCount = Math.round(total * 0.4);
  if (index < goldCount) return "gold";
  if (index < goldCount + redCount) return "red";
  return "white";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawBoxId = url.searchParams.get("boxId");
    const boxId = rawBoxId == null ? undefined : Number(rawBoxId);
    if (boxId != null && !boxes.some((box) => box.id === boxId)) {
      return Response.json({ error: "箱子不存在" }, { status: 404 });
    }
    const limit = Number(url.searchParams.get("limit") ?? 30);
    return Response.json(
      { drops: await listRecentDrops({ boxId, limit: Number.isFinite(limit) ? limit : 30 }) },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "最近掉落读取失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { boxId?: unknown; itemIds?: unknown };
    const boxId = Number(body.boxId);
    const openedBox = boxes.find((box) => box.id === boxId);
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.map(Number).filter((id) => Number.isInteger(id)).slice(0, 5)
      : [];
    if (!openedBox || !itemIds.length) return Response.json({ error: "开箱记录无效" }, { status: 400 });

    const start = Math.max(0, openedBox.id - 1);
    const contents = Array.from({ length: 10 }, (_, index) => boxes[(start + index) % boxes.length])
      .sort((left, right) => Number(right.itemValue) - Number(left.itemValue));
    const user = await currentUser(request);
    const userName = (user?.nickname || "玩家121").trim().slice(0, 40);
    const records = itemIds.flatMap((itemId) => {
      const item = boxes.find((candidate) => candidate.id === itemId);
      const itemIndex = contents.findIndex((candidate) => candidate.id === itemId);
      if (!item || itemIndex < 0) return [];
      return [{
        boxId: openedBox.id,
        boxName: openedBox.name,
        boxImageUrl: boxAssets[openedBox.tier],
        itemId: item.id,
        itemName: `${item.weaponName} (${item.preferredExterior})`,
        itemImageUrl: item.weaponSrc,
        rarity: getTone(itemIndex, contents.length),
        userName,
      }];
    });
    if (!records.length) return Response.json({ error: "饰品不属于该箱子" }, { status: 400 });
    return Response.json({ drops: await addRecentDrops(records) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "最近掉落写入失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
