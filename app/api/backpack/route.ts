import { gameDB,requireUser,sameOrigin,failure,GameError } from "@/db/game-auth";
import { databaseCatalog } from "@/db/game-battle";
import {getAccessoryById} from "@/db/accessories";
import {getAccessoryMarketVariants} from "@/db/prices";
import {cnyToGameTokens} from "@/lib/economy";
type Row={id:string;box_id:number;item_name:string;image_url:string;value_cents:number;acquired_at:number;recycled_at:number|null;status:string};
export async function GET(request:Request){try{
  const user=await requireUser(request);const url=new URL(request.url);const history=url.searchParams.get("view")==="history";
  const rows=await gameDB().prepare("SELECT * FROM game_inventory WHERE user_id=? AND status=? ORDER BY acquired_at DESC").bind(user.id,history?"recycled":"available").all<Row>();
  const items=(rows.results as Row[]).map(r=>({id:r.id,boxId:r.box_id,itemName:r.item_name,imageUrl:r.image_url,value:r.value_cents/100,acquiredAt:new Date(r.acquired_at).toISOString(),recycledAt:r.recycled_at?new Date(r.recycled_at).toISOString():null,status:r.status}));
  const sort=url.searchParams.get("sort");if(sort==="oldest")items.reverse();if(sort==="value-desc")items.sort((a,b)=>b.value-a.value);if(sort==="value-asc")items.sort((a,b)=>a.value-b.value);
  return Response.json(history?{records:items}:{items,tradeUrl:user.trade_url},{headers:{"cache-control":"no-store"}});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
  sameOrigin(request);const user=await requireUser(request);const body=await request.json();
  if(body.action==="add"){
    if(body.accessoryId){
      const accessory=await getAccessoryById(String(body.accessoryId));
      if(!accessory)throw new GameError("无效饰品");
      const variant=body.marketHashName?(await getAccessoryMarketVariants(String(accessory.id),{databaseOnly:true})).find(row=>row.marketHashName===body.marketHashName):null;
      if(body.marketHashName&&!variant)throw new GameError("该品质价格暂不可用");
      const value=variant?.priceTokens??(accessory.priceSource?cnyToGameTokens(Number(accessory.priceCny)):0);
      if(!(value>0))throw new GameError("饰品价格暂不可用");
      const id=crypto.randomUUID();
      await gameDB().prepare("INSERT INTO game_inventory(id,user_id,box_id,item_name,image_url,value_cents,acquired_at,status) VALUES(?,?,0,?,?,?,?,'available')")
        .bind(id,user.id,String(accessory.name)+(variant?` (${variant.marketHashName})`:""),String(accessory.imageUrl),Math.round(value*100),Date.now()).run();
      return Response.json({item:{id}});
    }
    const item=(await databaseCatalog()).find(b=>b.id===Number(body.boxId));if(!item)throw new GameError("无效饰品");
    const id=crypto.randomUUID();
    await gameDB().prepare("INSERT INTO game_inventory(id,user_id,box_id,item_name,image_url,value_cents,acquired_at,status) VALUES(?,?,?,?,?,?,?,'available')")
      .bind(id,user.id,item.id,item.weaponName+" ("+item.preferredExterior+")",item.weaponSrc,Math.round(Number(item.itemValue)*100),Date.now()).run();
    return Response.json({item:{id}});
  }
  if(body.action==="recycle"){
    if(!Array.isArray(body.ids)||body.ids.length>100||!body.ids.length)throw new GameError("请选择1至100件饰品");
    const ids=[...new Set(body.ids.map(String))];const placeholders=ids.map(()=>"?").join(",");
    const batchId=crypto.randomUUID();
    const results=await gameDB().batch([
      gameDB().prepare(`INSERT INTO game_wallet_ops(id,user_id,amount_cents,created_at) SELECT ?,?,COALESCE(SUM(value_cents),0),? FROM game_inventory WHERE user_id=? AND status='available' AND id IN (${placeholders})`).bind(batchId,user.id,Date.now(),user.id,...ids),
      gameDB().prepare("UPDATE game_users SET balance_cents=balance_cents+(SELECT amount_cents FROM game_wallet_ops WHERE id=?) WHERE id=?").bind(batchId,user.id),
      gameDB().prepare(`UPDATE game_inventory SET status='recycled',recycled_at=? WHERE user_id=? AND status='available' AND id IN (${placeholders})`).bind(Date.now(),user.id,...ids),
    ]);
    const op=await gameDB().prepare("SELECT amount_cents FROM game_wallet_ops WHERE id=?").bind(batchId).first<{amount_cents:number}>();
    return Response.json({count:results[2].meta.changes,totalValue:(op?.amount_cents??0)/100});
  }
  if(body.action==="save-trade-url"){
    const value=String(body.tradeUrl??"").trim();if(value.length>500||(value&&!/^https:\/\/steamcommunity\.com\/tradeoffer\/new\//i.test(value)))throw new GameError("请输入有效的 Steam 交易链接");
    await gameDB().prepare("UPDATE game_users SET trade_url=? WHERE id=?").bind(value,user.id).run();return Response.json({tradeUrl:value});
  }
  throw new GameError("无效操作");
}catch(e){return failure(e);}}
