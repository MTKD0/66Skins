import { gameDB,requireUser,sameOrigin,failure,GameError } from "@/db/game-auth";
import { createRoom,joinRoom,cancelRoom,readRoom,settleRoom,roomSnapshot,type RoomRow } from "@/db/game-battle";
export async function GET(request:Request) {try {
  const user=await requireUser(request);const url=new URL(request.url);const id=url.searchParams.get("id");
  if(id){const room=await settleRoom(await readRoom(id));if(room.host_id!==user.id&&room.opponent_id!==user.id)throw new GameError("你未加入此房间",403);return Response.json({room:roomSnapshot(room,true)},{headers:{"cache-control":"no-store"}});}
  const rows=await gameDB().prepare("SELECT * FROM game_rooms WHERE status IN ('waiting','playing') OR host_id=? OR opponent_id=? ORDER BY created_at DESC LIMIT 100").bind(user.id,user.id).all<RoomRow>();
  const rooms=[];for(const row of rows.results)rooms.push(roomSnapshot(await settleRoom(row)));
  return Response.json({rooms},{headers:{"cache-control":"no-store"}});
}catch(e){return failure(e);}}
export async function POST(request:Request) {try {
  sameOrigin(request);const user=await requireUser(request);const body=await request.json();
  if(!/^[\w-]{8,80}$/.test(String(body.requestId??"")))throw new GameError("缺少有效请求编号");
  const room=body.action==="create"?await createRoom(user,body.boxIds,body.robot===true,body.requestId):body.action==="join"?await joinRoom(user,String(body.id)):body.action==="cancel"?await cancelRoom(user,String(body.id)):null;
  if(!room)throw new GameError("无效操作");return Response.json({room:roomSnapshot(room,true)});
}catch(e){return failure(e);}}
