import {gameDB,requireUser,sameOrigin,failure,GameError} from "@/db/game-auth";
// Local memorial edition only: top-ups and solo gameplay remain simulations.
export async function POST(request:Request){try{
  sameOrigin(request);const user=await requireUser(request);const body=await request.json();
  const amount=body.action==="topup"?100000:Math.round(Number(body.amount)*100)*(body.action==="spend"?-1:1);
  if(!["topup","spend","credit"].includes(body.action)||!Number.isSafeInteger(amount)||!amount||Math.abs(amount)>100000000)throw new GameError("金额无效");
  if(!/^[\w-]{8,80}$/.test(body.requestId??""))throw new GameError("请求编号无效");
  const id=user.id+":"+body.requestId;
  await gameDB().batch([
    gameDB().prepare("UPDATE game_users SET balance_cents=balance_cents+? WHERE id=? AND balance_cents+?>=0 AND NOT EXISTS(SELECT 1 FROM game_wallet_ops WHERE id=?)").bind(amount,user.id,amount,id),
    gameDB().prepare("INSERT INTO game_wallet_ops(id,user_id,amount_cents,created_at) SELECT ?,?,?,? WHERE changes()=1").bind(id,user.id,amount,Date.now()),
  ]);
  const op=await gameDB().prepare("SELECT id FROM game_wallet_ops WHERE id=?").bind(id).first();if(!op)return Response.json({ok:false,error:"insufficient-balance"},{status:409});
  return Response.json({ok:true});
}catch(e){return failure(e);}}
