import { boxes, type ClassicBox } from "@/app/classic-box/box-data";
import { getClassicBoxMarketValues } from "./prices";
import { gameDB, GameError, type GameUser } from "./game-auth";
import { pickClassicBoxIndex } from "@/lib/classic-box-economy";
export const ROUND_MS=6500;
export type BattleResults = { left:ClassicBox; right:ClassicBox }[];
export type RoomRow = {id:string;host_id:string;opponent_id:string|null;host_name:string;opponent_name:string|null;robot:number;status:string;cost_cents:number;box_ids:string;catalog:string;results:string;started_at:number|null;created_at:number;winner_id:string|null};
export async function databaseCatalog() {
  const market=await getClassicBoxMarketValues({sync:false,databaseOnly:true});
  return boxes.map(box=>{
    const value=market.values.find(v=>v.boxId===box.id);
    // No hardcoded fallback: unavailable market values block room creation.
    if(!value?.priceSource || !value.priceCny || !Number.isFinite(value.itemValue) || value.itemValue<=0) throw new GameError(`「${box.name}」暂无数据库价格，请先同步价格`,503);
    return {...box,itemValue:value.itemValue.toFixed(2),price:value.boxPrice.toFixed(2),priceCny:value.priceCny,priceSource:value.priceSource,priceUpdatedAt:value.priceUpdatedAt??undefined};
  });
}
export function poolFor(catalog:ClassicBox[],id:number) {
  const start=catalog.findIndex(box=>box.id===id);
  return Array.from({length:10},(_,i)=>catalog[(start+i)%catalog.length]).sort((a,b)=>Number(b.itemValue)-Number(a.itemValue));
}
function draw(pool:ClassicBox[]) { const n=crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;return pool[pickClassicBoxIndex(pool.length,n)]; }
function generate(ids:number[],catalog:ClassicBox[]):BattleResults {return ids.map(id=>{const pool=poolFor(catalog,id);return {left:draw(pool),right:draw(pool)};});}
export async function readRoom(id:string) { const row=await gameDB().prepare("SELECT * FROM game_rooms WHERE id=?").bind(id).first<RoomRow>();if(!row)throw new GameError("房间不存在",404);return row; }
export async function createRoom(user:GameUser, ids:unknown, robot:boolean, requestId:string) {
  if(!Array.isArray(ids)||ids.length<1||ids.length>25||ids.some(id=>!Number.isInteger(id)||!boxes.some(b=>b.id===id)))throw new GameError("请选择1至25个有效箱子");
  const id=`${user.id}:${requestId}`;
  const existing=await gameDB().prepare("SELECT * FROM game_rooms WHERE id=?").bind(id).first<RoomRow>();if(existing)return existing;
  const catalog=await databaseCatalog();
  const cents=ids.reduce((sum,id)=>sum+Math.round(Number(catalog.find(b=>b.id===id)!.price)*100),0);
  if(!Number.isSafeInteger(cents)||cents<=0)throw new GameError("价格无效");
  const now=Date.now();
  // Batch is transactional. changes() connects the conditional debit to insertion.
  await gameDB().batch([
    gameDB().prepare("UPDATE game_users SET balance_cents=balance_cents-? WHERE id=? AND balance_cents>=? AND NOT EXISTS(SELECT 1 FROM game_rooms WHERE id=?)").bind(cents,user.id,cents,id),
    gameDB().prepare("INSERT INTO game_rooms(id,host_id,host_name,opponent_id,opponent_name,robot,status,cost_cents,box_ids,catalog,results,started_at,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1")
      .bind(id,user.id,user.nickname,robot?"robot":null,robot?"训练机器人·ALPHA":null,robot?1:0,robot?"playing":"waiting",cents,JSON.stringify(ids),JSON.stringify(catalog),robot?JSON.stringify(generate(ids,catalog)):"[]",robot?now+3000:null,now),
  ]);
  const row=await gameDB().prepare("SELECT * FROM game_rooms WHERE id=?").bind(id).first<RoomRow>();if(!row)throw new GameError("余额不足",409);return row;
}
export async function joinRoom(user:GameUser,id:string) {
  const room=await readRoom(id);
  if(room.opponent_id===user.id)return room;
  if(room.host_id===user.id)throw new GameError("不能加入自己的房间");
  if(room.status!=="waiting")throw new GameError("房间已满或已开始",409);
  const catalog=JSON.parse(room.catalog) as ClassicBox[];
  await gameDB().batch([
    gameDB().prepare("UPDATE game_rooms SET opponent_id=?,opponent_name=?,status='playing',started_at=?,results=? WHERE id=? AND status='waiting' AND opponent_id IS NULL AND EXISTS(SELECT 1 FROM game_users WHERE id=? AND balance_cents>=?)")
      .bind(user.id,user.nickname,Date.now()+3000,JSON.stringify(generate(JSON.parse(room.box_ids),catalog)),id,user.id,room.cost_cents),
    gameDB().prepare("UPDATE game_users SET balance_cents=balance_cents-? WHERE id=? AND changes()=1").bind(room.cost_cents,user.id),
  ]);
  const updated=await readRoom(id);if(updated.opponent_id!==user.id)throw new GameError("加入失败：余额不足或房间已被加入",409);return updated;
}
export async function cancelRoom(user:GameUser,id:string) {
  await gameDB().batch([
    gameDB().prepare("UPDATE game_rooms SET status='cancelled' WHERE id=? AND host_id=? AND status='waiting'").bind(id,user.id),
    gameDB().prepare("UPDATE game_users SET balance_cents=balance_cents+(SELECT cost_cents FROM game_rooms WHERE id=?) WHERE id=? AND changes()=1").bind(id,user.id),
  ]);return readRoom(id);
}
export async function settleRoom(room:RoomRow) {
  if(room.status!=="playing" || !room.started_at)return room;
  const results=JSON.parse(room.results) as BattleResults;
  if(Date.now()<room.started_at+results.length*ROUND_MS)return room;
  const left=results.reduce((s,r)=>s+Math.round(Number(r.left.itemValue)*100),0);
  const right=results.reduce((s,r)=>s+Math.round(Number(r.right.itemValue)*100),0);
  const winner=left===right?null:left>right?room.host_id:room.opponent_id;
  const statements=[gameDB().prepare("UPDATE game_rooms SET status='finished',winner_id=? WHERE id=? AND status='playing'").bind(winner,room.id)];
  results.forEach((result,index)=>{(["left","right"] as const).forEach(side=>{
    const owner=winner ?? (side==="left"?room.host_id:room.opponent_id);if(!owner||owner==="robot")return;
    const item=result[side];
    statements.push(gameDB().prepare("INSERT OR IGNORE INTO game_inventory(id,user_id,room_id,box_id,item_name,image_url,value_cents,acquired_at,status) VALUES(?,?,?,?,?,?,?,?,'available')")
      .bind(`${room.id}:${index}:${side}`,owner,room.id,item.id,`${item.weaponName} (${item.preferredExterior})`,item.weaponSrc,Math.round(Number(item.itemValue)*100),Date.now()));
  });});
  await gameDB().batch(statements);return readRoom(room.id);
}
export function roomSnapshot(room:RoomRow,detail=false) {
  const ids=JSON.parse(room.box_ids) as number[];
  const elapsed=room.started_at?Date.now()-room.started_at:-1;
  const round=elapsed<0?-1:Math.min(ids.length-1,Math.floor(elapsed/ROUND_MS));
  const revealed=elapsed<0?0:Math.min(ids.length,Math.floor((elapsed+1000)/ROUND_MS));
  const all=JSON.parse(room.results) as BattleResults;
  return {id:room.id,hostId:room.host_id,opponentId:room.opponent_id,host:room.host_name,opponent:room.opponent_name,robot:!!room.robot,
    status:room.status,entry:room.cost_cents/100,rounds:ids.length,boxIds:ids,tier:boxes.find(b=>b.id===ids[0])?.tier??"blue",winnerId:room.winner_id,
    startedAt:room.started_at,serverNow:Date.now(),round,revealed,
    ...(detail?{catalog:JSON.parse(room.catalog),results:all.slice(0,Math.max(0,round+1))}:{}),
    playerTotal:all.slice(0,revealed).reduce((s,r)=>s+Number(r.left.itemValue),0),opponentTotal:all.slice(0,revealed).reduce((s,r)=>s+Number(r.right.itemValue),0)};
}
