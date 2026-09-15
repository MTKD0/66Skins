export const ACCOUNTS_KEY="66skins:local-accounts:v1";
export const SESSION_KEY="66skins:local-session:v1";
export const USER_EVENT="66skins:user-change";
export const LOGIN_REQUEST_EVENT="66skins:login-request";
export const DEFAULT_BALANCE=1000;
export const PAYMENT_AMOUNT=1000;
export type LocalWalletResult={ok:boolean;balance?:number;error?:string};
export function refreshUser(){window.dispatchEvent(new Event(USER_EVENT));}
async function adjust(action:string,amount:number):Promise<LocalWalletResult>{
  try{const response=await fetch("/api/wallet",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,amount,requestId:crypto.randomUUID()})});const data=await response.json();refreshUser();return response.ok?data:{ok:false,error:response.status===401?"login-required":data.error};}
  catch{return {ok:false,error:"network-error"};}
}
export const spendLocalBalance=(amount:number)=>adjust("spend",amount);
export const creditLocalBalance=(amount:number)=>adjust("credit",amount);
export function requestLocalLogin(message="请先登录"){window.dispatchEvent(new CustomEvent(LOGIN_REQUEST_EVENT,{detail:message}));}
