"use client";
import Image from "next/image";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {createPortal} from "react-dom";
import {USER_EVENT,LOGIN_REQUEST_EVENT,DEFAULT_BALANCE,refreshUser} from "./local-wallet";
export type LocalUser={id:string;username:string;nickname:string;balance:number};
export function useLocalUser(){
  const [user,setUser]=useState<LocalUser|null>(null);const [ready,setReady]=useState(false);
  const refresh=useCallback(async()=>{try{const r=await fetch("/api/auth",{cache:"no-store"});if(r.ok)setUser((await r.json()).user);}catch{}finally{setReady(true);}},[]);
  useEffect(()=>{void refresh();const update=()=>void refresh();window.addEventListener(USER_EVENT,update);window.addEventListener("focus",update);const timer=window.setInterval(update,5000);return()=>{window.removeEventListener(USER_EVENT,update);window.removeEventListener("focus",update);window.clearInterval(timer);};},[refresh]);
  return {user,ready,refresh};
}
export function SiteUserControls({backpackActive=false,onNotify}:{backpackActive?:boolean;onNotify:(message:string)=>void}){
  const {user,ready}=useLocalUser();const [dialog,setDialog]=useState<"login"|"register"|"account"|null>(null);
  const [username,setUsername]=useState("");const [password,setPassword]=useState("");const [nickname,setNickname]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{const listener=(e:Event)=>{setError((e as CustomEvent<string>).detail??"");setDialog("login");};window.addEventListener(LOGIN_REQUEST_EVENT,listener);return()=>window.removeEventListener(LOGIN_REQUEST_EVENT,listener);},[]);
  useEffect(()=>{if(!dialog)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setDialog(null);};document.addEventListener("keydown",esc);return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",esc);};},[dialog]);
  async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError("");try{const r=await fetch("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:dialog,username,password,nickname})});const d=await r.json();if(!r.ok)throw new Error(d.error);setPassword("");setDialog(null);refreshUser();onNotify("欢迎，"+d.user.nickname);}catch(e){setError(e instanceof Error?e.message:"暂时无法登录");}finally{setBusy(false);}}
  async function logout(){if(busy)return;setBusy(true);try{const r=await fetch("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"logout"})});if(!r.ok)throw new Error();refreshUser();setDialog(null);}catch{onNotify("退出失败，请稍后重试");}finally{setBusy(false);}}
  async function topup(){if(!user){setDialog("login");return;}if(busy)return;setBusy(true);try{const r=await fetch("/api/wallet",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"topup",requestId:crypto.randomUUID()})});if(!r.ok)throw new Error();refreshUser();onNotify("模拟支付成功，余额增加 G 1000.00");}catch{onNotify("暂时无法增加余额");}finally{setBusy(false);}}
  return <><div className="account-actions shared-account-actions"><button type="button" disabled={busy} onClick={topup}><span>▣</span>支付</button><button type="button" className={backpackActive?"active":""} onClick={()=>window.location.assign("/backpack")}><span>▤</span>背包</button></div>
    {user?<button className="shared-user-identity" onClick={()=>setDialog("account")} aria-label="查看账号信息"><b>{user.nickname}</b><small>G {user.balance.toFixed(2)}</small></button>:<button className="login-button classic-login shared-login-button" onClick={()=>{setDialog("login");setError("");}}>注册 / 登录</button>}
    <Image className="avatar shared-avatar" src="/assets/default-avatar.png" alt="默认头像" width={70} height={70}/>
    {ready&&dialog&&createPortal(<div className="shared-user-overlay" role="dialog" aria-modal="true" aria-labelledby="shared-user-title"><section className="shared-user-dialog"><button className="shared-user-close" aria-label="关闭" onClick={()=>setDialog(null)}>×</button>
      {dialog==="account"?<div className="shared-account-panel"><h2 id="shared-user-title">账号信息</h2><b>{user?.nickname}</b><p>账号：{user?.username}</p><strong>G {user?.balance.toFixed(2)}</strong><button onClick={logout}>退出登录</button></div>:<form onSubmit={submit}>
        <h2 id="shared-user-title">{dialog==="register"?"注册账号":"账号登录"}</h2><p>{dialog==="register"?"注册赠送 G "+DEFAULT_BALANCE+"，仅限本地娱乐。":"使用已注册的账号登录。"}</p>
        <label>账号<input autoFocus required pattern="[A-Za-z0-9]+" maxLength={32} autoComplete="username" placeholder="英文、数字" value={username} onChange={e=>setUsername(e.target.value)}/></label>
        {dialog==="register"&&<label>昵称<input required maxLength={24} placeholder="请输入昵称" value={nickname} onChange={e=>setNickname(e.target.value)}/></label>}
        <label>密码<input required type="password" minLength={8} maxLength={128} autoComplete={dialog==="register"?"new-password":"current-password"} placeholder="至少8个字符" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        {error&&<div className="shared-user-error" role="alert">{error}</div>}<button className="shared-user-submit" disabled={busy} type="submit">{busy?"处理中…":dialog==="register"?"注册并登录":"登录"}</button>
        <button type="button" onClick={()=>{setDialog(dialog==="register"?"login":"register");setError("");}}>{dialog==="register"?"已有账号？登录":"没有账号？注册"}</button>
      </form>}</section></div>,document.body)}
  </>;
}
