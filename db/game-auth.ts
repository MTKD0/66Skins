import { env } from "cloudflare:workers";

export const gameDB = () => { if (!env.DB) throw new Error("数据库未连接"); return env.DB; };
export type GameUser = { id: string; username: string; nickname: string; balance_cents: number; trade_url: string };
export class GameError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const failure = (error: unknown) => Response.json({ error: error instanceof GameError ? error.message : "服务暂时不可用，请稍后重试" }, { status: error instanceof GameError ? error.status : 500 });
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set([requestUrl.origin]);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    try {
      allowedOrigins.add(new URL(`${forwardedProto || requestUrl.protocol.replace(":", "")}://${forwardedHost}`).origin);
    } catch {
      throw new GameError("请求来源无效", 403);
    }
  }
  if ((origin && !allowedOrigins.has(origin)) || request.headers.get("sec-fetch-site") === "cross-site") throw new GameError("请求来源无效", 403);
}
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,"0")).join("");
const digest = async (value: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name:"PBKDF2",hash:"SHA-256",salt:new TextEncoder().encode(salt),iterations:100000 },key,256));
}
export const publicUser = (u: GameUser) => ({ id:u.id, username:u.username,nickname:u.nickname,balance:u.balance_cents/100 });
export async function currentUser(request: Request) {
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)skins_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  return gameDB().prepare("SELECT u.id,u.username,u.nickname,u.balance_cents,u.trade_url FROM game_users u JOIN game_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?").bind(await digest(token),Date.now()).first<GameUser>();
}
export async function requireUser(request: Request) { const u = await currentUser(request); if (!u) throw new GameError("请先登录",401); return u; }
export async function authenticate(request: Request, body: Record<string,unknown>) {
  sameOrigin(request);
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const nickname = String(body.nickname ?? "").trim();
  if (!/^[a-z0-9]{1,32}$/.test(username)) throw new GameError("账号只能填写英文和数字，最多32位");
  if (password.length < 8 || password.length > 128) throw new GameError("密码需要8至128个字符");
  const key = await digest("auth:"+username);
  const now=Date.now();
  await gameDB().prepare("INSERT INTO game_attempts(key,count,since) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN since<? THEN 1 ELSE count+1 END,since=CASE WHEN since<? THEN ? ELSE since END").bind(key,now,now-900000,now-900000,now).run();
  const attempt=await gameDB().prepare("SELECT count FROM game_attempts WHERE key=?").bind(key).first<{count:number}>();
  if (attempt && attempt.count>15) throw new GameError("尝试次数过多，请15分钟后重试",429);
  if (body.action === "register") {
    if (!nickname || nickname.length>24 || /[\x00-\x1f]/.test(nickname)) throw new GameError("昵称需要1至24个字符");
    const salt=hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
    const hashed=await passwordHash(password,salt);
    const result=await gameDB().prepare("INSERT OR IGNORE INTO game_users(id,username,nickname,password_hash,salt,balance_cents,trade_url,created_at) VALUES(?,?,?,?,?,100000,'',?)").bind(crypto.randomUUID(),username,nickname,hashed,salt,now).run();
    if (!result.meta.changes) throw new GameError("账号已被注册",409);
  }
  const row=await gameDB().prepare("SELECT * FROM game_users WHERE username=?").bind(username).first<GameUser & {salt:string;password_hash:string}>();
  const hash=await passwordHash(password,row?.salt ?? "invalid-account-dummy-salt");
  let different=0; for(let i=0;i<64;i++) different|=hash.charCodeAt(i)^(row?.password_hash ?? "0".repeat(64)).charCodeAt(i);
  if (!row || different) throw new GameError("账号或密码不正确",401);
  await gameDB().prepare("DELETE FROM game_attempts WHERE key=?").bind(key).run();
  const token=hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  await gameDB().prepare("INSERT INTO game_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await digest(token),row.id,now+7*86400000).run();
  return Response.json({user:publicUser(row)}, {headers:{"set-cookie":`skins_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,"cache-control":"no-store"}});
}
export async function logout(request: Request) {
  sameOrigin(request);
  const token=request.headers.get("cookie")?.match(/(?:^|;\s*)skins_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(token) await gameDB().prepare("DELETE FROM game_sessions WHERE token_hash=?").bind(await digest(token)).run();
  return Response.json({ok:true},{headers:{"set-cookie":"skins_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"}});
}
