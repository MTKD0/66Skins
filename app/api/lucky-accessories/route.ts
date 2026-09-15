import { listLuckyAccessories } from "@/db/lucky-accessories";
import { failure } from "@/db/game-auth";

export async function GET(request: Request) {
  try {
    return Response.json(await listLuckyAccessories(new URL(request.url).searchParams), {headers:{"cache-control":"no-store"}});
  } catch (error) { return failure(error); }
}
