"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { GameCenterMenu } from "../components/game-center-menu";
import { SiteToast } from "../components/site-toast";
import { SiteUserControls, useLocalUser } from "../components/site-user-controls";
import { requestLocalLogin, refreshUser, USER_EVENT } from "../components/local-wallet";
import { boxes, type ClassicBox, type Tier } from "../classic-box/box-data";

import { TransparentBattleBox } from "./transparent-battle-box";
import "../classic-box/classic-box.css";
import "./battle.css";

type BattleTab = "member" | "history";
type BattleStatus = "waiting" | "playing" | "ended";

type BattleRoom = {
  id: number | string;
  hostId: string;
  opponentId: string | null;
  host: string;
  opponent?: string;
  rounds: number;
  entry: number;
  status: BattleStatus;
  tier: Tier;
  boxIds: number[];
  result?: string;
};



const statusLabels: Record<BattleStatus, string> = { waiting: "等待中", playing: "对战中", ended: "已结束" };

export default function BattlePage() {
  const [tab, setTab] = useState<BattleTab>("member");
  const [status, setStatus] = useState<"all" | BattleStatus>("all");
  const [toast, setToast] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBoxIds, setSelectedBoxIds] = useState<number[]>([]);
  const [useRobot, setUseRobot] = useState(false);
  const {user} = useLocalUser();
  const [serverRooms, setServerRooms] = useState<BattleRoom[]>([]);
  const [creating, setCreating] = useState(false);
  const [marketPrices, setMarketPrices] = useState<Record<number, number>>({});

  useEffect(() => {
    const controller = new AbortController();
    const refreshHistory = async () => { try { const r=await fetch("/api/battles",{signal:controller.signal,cache:"no-store"}); if(r.ok)setServerRooms((await r.json()).rooms.map((room: Omit<BattleRoom, "status"> & {status:string})=>({...room,status:room.status==="finished"?"ended":room.status})).filter((room: Omit<BattleRoom, "status"> & {status:string})=>room.status!=="cancelled"));else if(r.status===401)setServerRooms([]); } catch {} };
    void refreshHistory();
    const interval=window.setInterval(refreshHistory,3000);
    window.addEventListener("focus",refreshHistory);
    window.addEventListener(USER_EVENT,refreshHistory);
    fetch("/api/classic-boxes").then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { values?: Array<{ boxId: number; boxPrice: number }> }) => setMarketPrices(Object.fromEntries((payload.values ?? []).map((entry) => [entry.boxId, Number(entry.boxPrice)]))))
      .catch(() => undefined);
    return () => {controller.abort();window.clearInterval(interval);window.removeEventListener("focus", refreshHistory);window.removeEventListener(USER_EVENT,refreshHistory);};
  }, []);

  const pricedBoxes = useMemo(() => boxes.map((box) => ({ ...box, price: Number(marketPrices[box.id] ?? 0).toFixed(2) })), [marketPrices]);

  const notify = (message: string) => {
    setToast("");
    window.setTimeout(() => setToast(message), 0);
  };

  const rooms = useMemo(() => {
    const source = serverRooms.filter(room => tab === "history" ? room.status === "ended" : room.status !== "ended");
    return status === "all" ? source : source.filter((room) => room.status === status);
  }, [serverRooms, status, tab]);

  const createRoom = async () => {
    if(creating || !selectedBoxIds.length)return;
    setCreating(true);
    try {
      const response=await fetch("/api/battles",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"create",boxIds:selectedBoxIds,robot:useRobot,requestId:crypto.randomUUID()})});
      const data=await response.json();if(!response.ok){if(response.status===401)requestLocalLogin();throw new Error(data.error);}
      refreshUser();window.location.assign("/battle/room?id="+encodeURIComponent(data.room.id));
    }catch(e){notify(e instanceof Error?e.message:"创建失败");}finally{setCreating(false);}
  };
  const joinRoom = async (id: number|string) => {
    if(!user){requestLocalLogin("请先登录后加入真人对战");return;}
    try {const r=await fetch("/api/battles",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"join",id,requestId:crypto.randomUUID()})});const d=await r.json();if(!r.ok)throw new Error(d.error);refreshUser();window.location.assign("/battle/room?id="+encodeURIComponent(id));}catch(e){notify(e instanceof Error?e.message:"加入失败");}
  };

  const selectTab = (next: BattleTab) => {
    setTab(next);
    setStatus(next === "history" ? "ended" : "all");
  };

  return (
    <div className="classic-shell battle-shell">
      <header className="classic-topbar">
        <div className="classic-header-inner">
          <button className="classic-brand" type="button" onClick={() => window.location.assign("/")} aria-label="返回首页"><Image src="/assets/logo.png" alt="66SKINS" width={336} height={60} priority /></button>
          <nav className="classic-nav" aria-label="主导航">
            <button type="button" onClick={() => window.location.assign("/")}><span>⌂</span>首页</button>
            <GameCenterMenu active="battle" buttonClassName="active" onUnavailable={notify} />
            <button type="button" onClick={() => notify("本地纪念版不提供真实交易与发货")}><span>▱</span>商城</button>
            <button type="button" onClick={() => notify("分享功能将在后续阶段恢复")}><span>↗</span>分享</button>
          </nav>
          <div className="classic-account"><SiteUserControls onNotify={notify} /></div>
        </div>
      </header>

      <main className="battle-page">
        <div className="battle-tabs" role="tablist" aria-label="对战页面">
          <button className={tab === "member" ? "active" : ""} type="button" role="tab" aria-selected={tab === "member"} onClick={() => selectTab("member")}>会员对战</button>
          <button className={tab === "history" ? "active" : ""} type="button" role="tab" aria-selected={tab === "history"} onClick={() => selectTab("history")}>游戏历史</button>
          <button className="create-room" type="button" onClick={() => setCreateOpen(true)}>创建房间</button>
        </div>

        <section className="battle-panel">
          <div className="battle-notice"><b>!</b><span>对战为娱乐玩法：双方按所选盲盒顺序同步开箱，累计饰品价值更高的一方获胜并取得本局双方饰品。</span><button type="button" aria-label="关闭公告">×</button></div>

          <header className="battle-list-heading">
            <div><h1>{tab === "member" ? "会员对战房间" : "会员对战历史"}</h1><p>{tab === "member" ? "创建房间邀请另一位玩家，或加入等待中的对战" : "查看已经完成的会员对战与获胜结果"}</p></div>
            <div className="battle-status-filters" role="group" aria-label="房间状态筛选">
              {tab === "member" && <button className={status === "all" ? "active" : ""} type="button" onClick={() => setStatus("all")}><i />全部</button>}
              {tab === "member" && <button className={status === "playing" ? "active" : ""} type="button" onClick={() => setStatus("playing")}><i />对战中</button>}
              {tab === "member" && <button className={status === "waiting" ? "active" : ""} type="button" onClick={() => setStatus("waiting")}><i />等待中</button>}
              <button className={status === "ended" ? "active" : ""} type="button" onClick={() => setStatus("ended")}><i />已结束</button>
            </div>
          </header>

          <div className="battle-grid">
            {rooms.map((room) => <article className={`battle-room-card status-${room.status} tier-${room.tier}`} key={room.id}>
              <div className="room-card-top">{(room.hostId===user?.id||room.opponentId===user?.id)&&<button type="button" onClick={() => window.location.assign("/battle/room?id="+encodeURIComponent(room.id))}>查看房间</button>}<span>会员对战</span><b>{room.rounds}回合</b></div>
              <div className="room-players">
                <div className="room-player"><Image src="/assets/default-avatar.png" alt={room.host} width={90} height={90} /><strong>{room.host}</strong></div>
                <i>VS</i>
                {room.opponent ? <div className="room-player"><Image src="/assets/default-avatar.png" alt={room.opponent} width={90} height={90} /><strong>{room.opponent}</strong></div> : <button className="empty-player" type="button" disabled={room.hostId===user?.id} onClick={() => joinRoom(room.id)} aria-label="空余玩家位置">+</button>}
              </div>
              <div className="room-state"><span>{statusLabels[room.status]}</span>{room.status === "waiting" ? room.hostId===user?.id ? <button type="button" onClick={()=>window.location.assign("/battle/room?id="+encodeURIComponent(room.id))}>返回房间</button> : <button type="button" onClick={() => joinRoom(room.id)}>立即加入 <b>G {room.entry.toFixed(2)}</b></button> : <b>{room.result ?? `本局价值 G ${(room.entry * 2).toFixed(2)}`}</b>}</div>
              <div className="room-boxes" aria-label="本局盲盒">
                {room.boxIds.map((boxId, index) => <span key={`${room.id}-${boxId}-${index}`}><TransparentBattleBox tier={boxes.find((box) => box.id === boxId)?.tier ?? room.tier} alt={`第${index + 1}个盲盒`} /><small>{boxId}</small></span>)}
              </div>
            </article>)}
          </div>
          {!rooms.length && <div className="battle-empty">{tab === "history" ? "暂无已完成的本地对战记录" : "暂无在线房间，登录后创建第一场对战"}</div>}
        </section>
      </main>

      <aside className="classic-tools" aria-label="快捷工具"><button className="tool-welfare" type="button" onClick={() => notify("福利中心暂未开放")}><Image src="/assets/welfare.png" alt="福利中心" width={141} height={80} /></button><button type="button" onClick={() => notify("本地纪念版暂不提供群聊服务")}><b>●</b><span>一键加群</span></button><button type="button" onClick={() => notify("取回助手将在后续恢复")}><b>◉</b><span>取回助手</span></button><button type="button" onClick={() => notify("在线客服功能暂未开放")}><b>◒</b><span>在线客服</span></button><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><b>↑</b><span>返回顶部</span></button></aside>
      {createOpen && <CreateBattleModal boxes={pricedBoxes} selectedIds={selectedBoxIds} useRobot={useRobot} onRobotChange={setUseRobot} onSelectedChange={setSelectedBoxIds} onClose={() => setCreateOpen(false)} onCreate={createRoom} onNotify={notify} />}
      {toast && <SiteToast message={toast} />}
    </div>
  );
}

function CreateBattleModal({ boxes: sourceBoxes, selectedIds, useRobot, onRobotChange, onSelectedChange, onClose, onCreate, onNotify }: {
  boxes: ClassicBox[];
  selectedIds: number[];
  useRobot: boolean;
  onRobotChange: (value: boolean) => void;
  onSelectedChange: (value: number[]) => void;
  onClose: () => void;
  onCreate: () => void;
  onNotify: (message: string) => void;
}) {
  const [tier, setTier] = useState<"all" | Tier>("all");
  const visible = tier === "all" ? sourceBoxes : sourceBoxes.filter((box) => box.tier === tier);
  const selected = selectedIds.map((id) => sourceBoxes.find((box) => box.id === id)).filter(Boolean) as ClassicBox[];
  const total = selected.reduce((sum, box) => sum + Number(box.price), 0);
  const addBox = (id: number) => {
    if (selectedIds.length >= 25) return onNotify("单个房间最多选择 25 个盲盒");
    onSelectedChange([...selectedIds, id]);
  };
  const removeAt = (index: number) => onSelectedChange(selectedIds.filter((_, itemIndex) => itemIndex !== index));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    onSelectedChange(next);
  };

  return <div className="battle-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="battle-create-modal" role="dialog" aria-modal="true" aria-label="创建对战房间">
      <header><div><h2>创建会员对战</h2><p>按加入顺序开箱，可重复搭配任意箱子</p></div><button type="button" onClick={onClose} aria-label="关闭">×</button></header>
      <div className="selected-box-rail">
        <div className="selected-rail-title"><b>已选箱子</b><span>{selected.length} / 25</span></div>
        <div className="selected-rail-list">
          {selected.length ? selected.map((box, index) => <div className={`selected-box-chip tier-${box.tier}`} key={`${box.id}-${index}`}>
            <em>{index + 1}</em><TransparentBattleBox tier={box.tier} alt={box.name} /><span>{box.name}</span><small>G {box.price}</small>
            <div><button type="button" onClick={() => move(index, -1)} aria-label="向前移动">‹</button><button type="button" onClick={() => removeAt(index)} aria-label="移除">×</button><button type="button" onClick={() => move(index, 1)} aria-label="向后移动">›</button></div>
          </div>) : <p>点击下方箱子加入本局，选择顺序就是开箱顺序</p>}
        </div>
      </div>
      <div className="create-tier-tabs">{(["all", "blue", "red", "green"] as const).map((value) => <button className={tier === value ? "active" : ""} type="button" key={value} onClick={() => setTier(value)}>{value === "all" ? "全部" : value === "blue" ? "五五开" : value === "red" ? "三七开" : "一九开"}</button>)}</div>
      <div className="create-box-grid">
        {visible.map((box) => <button className={`create-box-card tier-${box.tier}`} type="button" key={box.id} disabled={Number(box.price)<=0} onClick={() => addBox(box.id)}>
          <TransparentBattleBox tier={box.tier} alt={box.name} /><span>{box.name}</span><b>{Number(box.price)>0?`G ${box.price}`:"价格暂不可用"}</b><i>+</i>
        </button>)}
      </div>
      <footer>
        <label><input type="checkbox" checked={useRobot} onChange={(event) => onRobotChange(event.target.checked)} /><span><b>加入机器人</b><small>勾选与机器人练习；不勾选等待真人加入</small></span></label>
        <div className="create-summary"><span>{selected.length} 个箱子</span><b>总计 G {total.toFixed(2)}</b><button type="button" disabled={!selected.length} onClick={onCreate}>创建对局</button></div>
      </footer>
    </section>
  </div>;
}
