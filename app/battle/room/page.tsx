"use client";
import Image from "next/image";
import {useEffect,useRef,useState} from "react";
import {GameCenterMenu} from "../../components/game-center-menu";
import {SiteToast} from "../../components/site-toast";
import {SiteUserControls,useLocalUser} from "../../components/site-user-controls";
import {refreshUser} from "../../components/local-wallet";
import {type ClassicBox} from "../../classic-box/box-data";
import {TransparentBattleBox} from "../transparent-battle-box";
import {BattleReel} from "./battle-reel";
import "../../classic-box/classic-box.css";
import "../battle.css";
import "./room.css";
type Snapshot={id:string;hostId:string;opponentId:string|null;host:string;opponent:string;boxIds:number[];status:string;catalog:ClassicBox[];results:{left:ClassicBox;right:ClassicBox}[];startedAt:number|null;serverNow:number;round:number;revealed:number;playerTotal:number;opponentTotal:number;winnerId:string|null};
function contentsFor(catalog:ClassicBox[],id:number){const start=catalog.findIndex(b=>b.id===id);return Array.from({length:10},(_,i)=>catalog[(start+i)%catalog.length]).sort((a,b)=>Number(b.itemValue)-Number(a.itemValue));}
export default function BattleRoomPage(){
  const [config,setConfig]=useState<Snapshot|null>(null);const [toast,setToast]=useState("");const {user}=useLocalUser();const soundRound=useRef(-1);
  useEffect(()=>{let stopped=false;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();const id=new URLSearchParams(window.location.search).get("id");
    if(!id){setToast("请从大厅打开一个服务器房间");return;}
    async function poll(){try{const r=await fetch("/api/battles?id="+encodeURIComponent(id!),{signal:controller.signal,cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);if(!stopped)setConfig(d.room);}catch(e){if(!stopped)setToast(e instanceof Error?e.message:"连接中断，正在重试");}finally{if(!stopped)timer=setTimeout(poll,600);}}
    void poll();return()=>{stopped=true;controller.abort();clearTimeout(timer);};
  },[]);
  const phase=!config?"loading":config.status==="finished"?"finished":config.status==="cancelled"?"cancelled":config.status==="waiting"?"waiting":config.round<0?"countdown":"playing";
  const round=config?.round??-1;const revealedRound=(config?.revealed??0)-1;const catalog=config?.catalog??[];
  const playerResults=config?.results.map(r=>r.left)??[];const opponentResults=config?.results.map(r=>r.right)??[];
  const playerTotal=config?.playerTotal??0;const opponentTotal=config?.opponentTotal??0;
  const hostWon=config?.winnerId===config?.hostId;const playerWon=config?.winnerId===user?.id;const draw=phase==="finished"&&!config?.winnerId;
  const currentBox=catalog.find(b=>b.id===config?.boxIds[Math.max(0,round)]);const mine=playerResults[round];const theirs=opponentResults[round];
  const countdown=Math.max(1,Math.ceil(((config?.startedAt??0)-(config?.serverNow??0))/1000));
  const elapsedMs=Math.max(0,(config?.serverNow??0)-(config?.startedAt??0)-Math.max(0,round)*6500);
  useEffect(()=>{if(phase==="playing"&&round!==soundRound.current){soundRound.current=round;const a=new Audio("/assets/audio/box-open.mp3");void a.play().catch(()=>{});}if(phase==="finished"){refreshUser();}},[phase,round]);
  const onReelComplete=()=>{};
  const notify=(message:string)=>setToast(message);
  const cancel=async()=>{try{const r=await fetch("/api/battles",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"cancel",id:config?.id,requestId:crypto.randomUUID()})});if(!r.ok)throw new Error((await r.json()).error);refreshUser();window.location.assign("/battle");}catch(e){notify(e instanceof Error?e.message:"取消失败");}};
  return <div className="classic-shell battle-room-shell">
    <header className="classic-topbar"><div className="classic-header-inner">
      <button className="classic-brand" type="button" onClick={() => window.location.assign("/")}><Image src="/assets/logo.png" alt="66SKINS" width={336} height={60} priority /></button>
      <nav className="classic-nav"><button type="button" onClick={() => window.location.assign("/")}><span>⌂</span>首页</button><GameCenterMenu active="battle" buttonClassName="active" onUnavailable={notify} /><button type="button" onClick={() => notify("商城暂未开放")}><span>▱</span>商城</button><button type="button" onClick={() => notify("分享功能将在后续恢复")}><span>↗</span>分享</button></nav>
      <div className="classic-account"><SiteUserControls onNotify={notify} /></div>
    </div></header>

    <main className="battle-arena">
      <section className="battle-arena-stage">
        <div className="battle-box-sequence">
          {(config?.boxIds ?? []).map((id, index) => {
            const item = catalog.find((box) => box.id === id)!;
            return <div className={`arena-box ${index === round ? "active" : ""} ${index < round ? "opened" : ""}`} key={`${id}-${index}`}><TransparentBattleBox tier={item.tier} alt={item.name} /><span>{item.name}</span></div>;
          })}
        </div>
        <div className="arena-progress">{phase === "playing" || phase === "finished" ? `${Math.min(round + 1, config?.boxIds.length ?? 0)} / ${config?.boxIds.length ?? 0}` : `0 / ${config?.boxIds.length ?? 0}`}</div>

        {phase === "waiting" && <div className="arena-overlay waiting-card"><b>等待对手加入</b><p>另一位玩家可在大厅加入此房间</p><button type="button" onClick={cancel}>取消等待并退款</button></div>}
        {phase === "countdown" && <div className="arena-overlay arena-countdown"><small>双方准备完毕</small><b key={countdown}>{countdown}</b><span>即将开始</span></div>}

        <div className={`duel-board phase-${phase}`}>
          <PlayerLane side="left" name={config?.host ?? "玩家"} value={playerTotal} item={mine} boxId={currentBox?.id} onComplete={onReelComplete} catalog={catalog} elapsedMs={elapsedMs} round={round} winner={phase === "finished" && (hostWon || draw)} loser={phase === "finished" && !hostWon && !draw} />
          <div className="duel-center"><b>VS</b><span>{currentBox?.name ?? "等待开始"}</span></div>
          <PlayerLane side="right" name={config?.opponent ?? "对手"} value={opponentTotal} item={theirs} boxId={currentBox?.id} onComplete={onReelComplete} catalog={catalog} elapsedMs={elapsedMs} round={round} winner={phase === "finished" && (!hostWon || draw)} loser={phase === "finished" && hostWon && !draw} />
        </div>
        <div className="battle-loot-columns">
          <LootList name={config?.host ?? "玩家"} items={playerResults.slice(0, revealedRound + 1)} />
          <LootList name={config?.opponent ?? "对手"} items={opponentResults.slice(0, revealedRound + 1)} />
        </div>
        {phase === "finished" && <div className="battle-finish-actions"><p>{draw ? "势均力敌，本局平局" : playerWon ? "胜利！奖励已由服务器放入你的背包" : "再接再厉，本局由对手获胜"}</p><button type="button" onClick={() => window.location.assign("/battle")}>返回对战大厅</button></div>}
      </section>
    </main>
    {toast && <SiteToast message={toast} />}
  </div>;
}

function PlayerLane({ side, name, value, item, boxId, onComplete, catalog, elapsedMs, round, winner, loser }: { side: "left" | "right"; name: string; value: number; item?: ClassicBox; boxId?: number; catalog: ClassicBox[]; elapsedMs: number; onComplete: (side: string, round: number) => void; round: number; winner: boolean; loser: boolean }) {
  return <section className={`player-lane ${side} ${winner ? "winner" : ""} ${loser ? "loser" : ""}`}>
    <div className="lane-result-banner">{winner ? <><b>胜利</b><small>WINNER</small></> : loser ? <><b>再接再厉</b><small>FAILED</small></> : <><b>{round < 0 ? "准备就绪" : `第 ${round + 1} 回合`}</b><small>OPENING</small></>}</div>
    <div className="lane-item-wrap" key={`${round}-${item?.id ?? 0}`}>
      {item && boxId ? <BattleReel item={item} contents={contentsFor(catalog, boxId)} elapsedMs={elapsedMs} side={side} round={round} onComplete={onComplete} /> : <div className="lane-placeholder"><span>?</span></div>}
    </div>
    <div className="lane-player"><Image src="/assets/default-avatar.png" alt={name} width={88} height={88} /><strong>{name}</strong><b>累计 G {value.toFixed(2)}</b></div>
  </section>;
}

function LootList({ name, items }: { name: string; items: ClassicBox[] }) {
  return <section className="battle-loot" aria-label={name + "的本局饰品"}>
    <h2>{name} · 已开出饰品 <small>{items.length} 件</small></h2>
    {!items.length ? <p className="battle-loot-empty">每回合结束后，饰品与价格将显示在这里</p> :
      <div className="battle-loot-grid">{items.map((item, index) => <article className="battle-loot-card" key={index}>
        <small>第 {index + 1} 回合</small>
        <Image src={item.weaponSrc} alt={item.weaponName} width={200} height={125} />
        <strong title={item.weaponName}>{item.weaponName}</strong>
        <span>{item.preferredExterior}</span><b>G {Number(item.itemValue).toFixed(2)}</b>
      </article>)}</div>}
  </section>;
}
