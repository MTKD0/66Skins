import { getClassicBoxMarketValues, maybeSyncMarketPrices } from "@/db/prices";

export async function GET() {
  try {
    return Response.json(await getClassicBoxMarketValues({sync:false,databaseOnly:true}), {headers:{"cache-control":"no-store"}});
  } catch (error) {
    const message = error instanceof Error ? error.message : "饰品价格读取失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    await maybeSyncMarketPrices(true);
    return Response.json(await getClassicBoxMarketValues({ sync: false }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "饰品价格更新失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
