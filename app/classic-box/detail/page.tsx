"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RecentBoxDrops, RecentDropsStrip } from "../../components/recent-drops-strip";
import { SiteToast } from "../../components/site-toast";
import { GameCenterMenu } from "../../components/game-center-menu";
import { SiteUserControls } from "../../components/site-user-controls";
import { creditLocalBalance, requestLocalLogin, spendLocalBalance } from "../../components/local-wallet";
import { boxAssets, boxes, type ClassicBox } from "../box-data";
import { classicBoxProbabilityLegend, getClassicBoxProbability, pickClassicBoxIndex } from "@/lib/classic-box-economy";
import "../classic-box.css";
import "./box-detail.css";

type DetailTab = "items" | "history" | "drop" | "type";
type ItemTone = "gold" | "red" | "blue";
type OpenPhase = "idle" | "intro" | "rolling" | "settled" | "reward";

type RollColumn = {
  items: ClassicBox[];
  offset: number;
  stopRatio: number;
};

const ROLL_TARGET_INDEX = 33;

const detailCutoutCache = new Map<string, Promise<string>>();

function createDetailCutout(src: string) {
  const cached = detailCutoutCache.get(src);
  if (cached) return cached;

  const cutout = new Promise<string>((resolve, reject) => {
    const source = new window.Image();
    source.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return reject(new Error("Canvas is not available"));
      context.drawImage(source, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const values = pixels.data;
      for (let index = 0; index < values.length; index += 4) {
        const brightest = Math.max(values[index], values[index + 1], values[index + 2]);
        if (brightest <= 4) values[index + 3] = 0;
        else if (brightest < 28) values[index + 3] = Math.round(values[index + 3] * Math.pow((brightest - 4) / 24, 0.72));
      }
      context.putImageData(pixels, 0, 0);
      canvas.toBlob((blob) => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("Cutout could not be created")), "image/png");
    };
    source.onerror = () => reject(new Error(`Could not load ${src}`));
    source.src = src;
  });
  detailCutoutCache.set(src, cutout);
  return cutout;
}

function getTone(index: number, total: number): ItemTone {
  const goldCount = Math.max(1, Math.round(total * 0.1));
  const redCount = Math.round(total * 0.4);
  if (index < goldCount) return "gold";
  if (index < goldCount + redCount) return "red";
  return "blue";
}

function playAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}

const tabLabels: Array<{ id: DetailTab; label: string }> = [
  { id: "items", label: "物品列表" },
  { id: "history", label: "历史掉落" },
  { id: "drop", label: "掉落统计" },
  { id: "type", label: "类型统计" },
];

export default function ClassicBoxDetailPage() {
  const [boxId, setBoxId] = useState(5);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<DetailTab>("items");
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [toast, setToast] = useState("");
  const [cutoutSrc, setCutoutSrc] = useState("");
  const [openPhase, setOpenPhase] = useState<OpenPhase>("idle");
  const [winners, setWinners] = useState<ClassicBox[]>([]);
  const [rollColumns, setRollColumns] = useState<RollColumn[]>([]);
  const [marketValues, setMarketValues] = useState<Record<number, { itemValue: number; boxPrice: number; priceCny: number | null; priceSource: string | null; priceUpdatedAt: string | null; exteriorName: string }>>({});
  const rollerRef = useRef<HTMLDivElement>(null);
  const rollerTrackRef = useRef<HTMLDivElement>(null);
  const multiRollerRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const tickFrameRef = useRef<number | null>(null);
  const tickCardIndicesRef = useRef<number[]>([]);
  const openAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectedAudioRef = useRef<HTMLAudioElement | null>(null);
  const rewardAudioRef = useRef<HTMLAudioElement | null>(null);
  const tickAudioPoolRef = useRef<HTMLAudioElement[]>([]);
  const tickAudioCursorRef = useRef(0);
  const recordedDropRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = Number(new URLSearchParams(window.location.search).get("box"));
      if (boxes.some((item) => item.id === value)) setBoxId(value);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/classic-boxes")
      .then(async (response) => {
        if (!response.ok) throw new Error("价格读取失败");
        return response.json() as Promise<{ values?: Array<{ boxId: number; itemValue: number; boxPrice: number; priceCny: number | null; priceSource: string | null; priceUpdatedAt: string | null; exteriorName: string }> }>;
      })
      .then((payload) => {
        if (!active) return;
        setMarketValues(Object.fromEntries((payload.values ?? []).map((entry) => [entry.boxId, entry])));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const pricedBoxes = useMemo(() => boxes.map((item) => {
    const market = marketValues[item.id];
    return market ? {
      ...item,
      price: Number(market.boxPrice).toFixed(2),
      itemValue: Number(market.itemValue).toFixed(2),
      priceCny: market.priceCny ?? undefined,
      priceSource: market.priceSource ?? undefined,
      priceUpdatedAt: market.priceUpdatedAt ?? undefined,
      preferredExterior: market.exteriorName || item.preferredExterior,
    } : item;
  }), [marketValues]);
  const box = pricedBoxes.find((item) => item.id === boxId) ?? pricedBoxes[4];
  const contents = useMemo(() => {
    const start = Math.max(0, box.id - 1);
    return Array.from({ length: 10 }, (_, index) => pricedBoxes[(start + index) % pricedBoxes.length])
      .sort((left, right) => Number(right.itemValue) - Number(left.itemValue));
  }, [box.id, pricedBoxes]);

  useEffect(() => {
    if (openPhase !== "reward" || recordedDropRef.current || !winners.length) return;
    recordedDropRef.current = true;
    void fetch("/api/recent-drops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ boxId: box.id, itemIds: winners.map((winner) => winner.id) }),
    }).then((response) => {
      if (response.ok) window.dispatchEvent(new Event("recent-drops:refresh"));
    }).catch(() => undefined);
  }, [box.id, openPhase, winners]);

  useEffect(() => {
    let active = true;
    createDetailCutout(boxAssets[box.tier])
      .then((result) => { if (active) setCutoutSrc(result); })
      .catch(() => { if (active) setCutoutSrc(boxAssets[box.tier]); });
    return () => { active = false; };
  }, [box.tier]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.body.style.overflow = openPhase === "idle" ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [openPhase]);

  useEffect(() => {
    const prepare = (src: string, volume: number) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = volume;
      return audio;
    };
    openAudioRef.current = prepare("/assets/audio/box-open.mp3", 0.72);
    selectedAudioRef.current = prepare("/assets/audio/selected.mp3", 0.82);
    rewardAudioRef.current = prepare("/assets/audio/reward.mp3", 0.78);
    tickAudioPoolRef.current = Array.from({ length: 6 }, () => prepare("/assets/audio/roll-tick.mp3", 0.42));
    return () => {
      [openAudioRef.current, selectedAudioRef.current, rewardAudioRef.current, ...tickAudioPoolRef.current].forEach((audio) => audio?.pause());
    };
  }, []);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    if (tickFrameRef.current !== null) window.cancelAnimationFrame(tickFrameRef.current);
  }, []);

  useEffect(() => {
    if (openPhase !== "rolling") return;
    const stopTickTracking = () => {
      if (tickFrameRef.current !== null) window.cancelAnimationFrame(tickFrameRef.current);
      tickFrameRef.current = null;
      tickCardIndicesRef.current = [];
    };
    const playTick = () => {
      const pool = tickAudioPoolRef.current;
      if (!pool.length) return;
      const audio = pool[tickAudioCursorRef.current % pool.length];
      tickAudioCursorRef.current += 1;
      playAudio(audio);
    };
    const trackCardEdges = () => {
      if (rollColumns.length === 1) {
        const viewport = rollerRef.current;
        const track = rollerTrackRef.current;
        const card = track?.querySelector<HTMLElement>(".roller-item");
        if (!viewport || !track || !card) return;
        const transform = window.getComputedStyle(track).transform;
        const translateX = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
        const currentCardIndex = Math.floor((viewport.clientWidth / 2 - translateX) / card.offsetWidth);
        const previous = tickCardIndicesRef.current[0];
        if (previous != null && currentCardIndex !== previous) {
          const crossedEdges = Math.min(4, Math.abs(currentCardIndex - previous));
          for (let index = 0; index < crossedEdges; index += 1) playTick();
        }
        tickCardIndicesRef.current[0] = currentCardIndex;
      } else {
        const viewports = multiRollerRef.current?.querySelectorAll<HTMLElement>(".multi-roller-column");
        const tracks = multiRollerRef.current?.querySelectorAll<HTMLElement>(".multi-roller-track");
        tracks?.forEach((track, columnIndex) => {
          const viewport = viewports?.[columnIndex];
          const card = track.querySelector<HTMLElement>(".multi-roller-item");
          if (!viewport || !card) return;
          const transform = window.getComputedStyle(track).transform;
          const translateY = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
          const currentCardIndex = Math.floor((viewport.clientHeight / 2 - translateY) / card.offsetHeight);
          const previous = tickCardIndicesRef.current[columnIndex];
          if (previous != null && currentCardIndex !== previous) {
            const crossedEdges = Math.min(3, Math.abs(currentCardIndex - previous));
            for (let index = 0; index < crossedEdges; index += 1) playTick();
          }
          tickCardIndicesRef.current[columnIndex] = currentCardIndex;
        });
      }
      tickFrameRef.current = window.requestAnimationFrame(trackCardEdges);
    };
    const animationFrame = window.requestAnimationFrame(() => {
      setRollColumns((columns) => columns.map((column, columnIndex) => {
        if (columns.length === 1) {
          const viewportWidth = rollerRef.current?.clientWidth ?? 1120;
          const cardWidth = rollerTrackRef.current?.querySelector<HTMLElement>(".roller-item")?.offsetWidth ?? 150;
          return { ...column, offset: viewportWidth / 2 - ROLL_TARGET_INDEX * cardWidth - cardWidth * column.stopRatio };
        }
        const viewport = multiRollerRef.current?.querySelectorAll<HTMLElement>(".multi-roller-column")[columnIndex];
        const cardHeight = viewport?.querySelector<HTMLElement>(".multi-roller-item")?.offsetHeight ?? 126;
        return { ...column, offset: (viewport?.clientHeight ?? 360) / 2 - ROLL_TARGET_INDEX * cardHeight - cardHeight / 2 };
      }));
      tickFrameRef.current = window.requestAnimationFrame(trackCardEdges);
    });
    const finalColumnDelay = Math.max(0, rollColumns.length - 1) * 100;
    timersRef.current.push(window.setTimeout(() => {
      stopTickTracking();
      playAudio(selectedAudioRef.current);
      setOpenPhase("settled");
    }, 4900 + finalColumnDelay));
    timersRef.current.push(window.setTimeout(() => {
      playAudio(rewardAudioRef.current);
      setOpenPhase("reward");
    }, 5900 + finalColumnDelay));
    return () => {
      window.cancelAnimationFrame(animationFrame);
      stopTickTracking();
    };
  }, [openPhase, rollColumns.length]);

  const unavailable = () => setToast("开箱功能暂未开放");
  const totalPrice = (Number(box.price) * quantity).toFixed(2);
  const legend = [classicBoxProbabilityLegend.gold, classicBoxProbabilityLegend.red, classicBoxProbabilityLegend.blue]
    .map((value) => Math.round(value * 100));

  const clearOpeningTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const startOpening = async () => {
    if (openPhase !== "idle") return;
    if (!(Number(box.price)>0) || contents.some(item=>!item.priceSource || !(Number(item.itemValue)>0))) {
      setToast("饰品价格暂不可用，请稍后重试");
      return;
    }
    const payment = await spendLocalBalance(Number(totalPrice));
    if (!payment.ok) {
      if (payment.error !== "insufficient-balance") requestLocalLogin("请先登录后再开启盲盒");
      setToast(payment.error === "insufficient-balance" ? `余额不足，开启需要 G ${totalPrice}` : "请先登录后再开启盲盒");
      return;
    }
    clearOpeningTimers();
    recordedDropRef.current = false;
    playAudio(openAudioRef.current);
    const selectedWinners = Array.from({ length: quantity }, () => contents[pickClassicBoxIndex(contents.length)]);
    const columns = selectedWinners.map((selectedWinner) => {
      const start = Math.floor(Math.random() * contents.length);
      const sequence = Array.from({ length: 42 }, (_, index) => contents[(start + index) % contents.length]);
      sequence[ROLL_TARGET_INDEX] = selectedWinner;
      return { items: sequence, offset: 0, stopRatio: 0.18 + Math.random() * 0.64 };
    });
    setWinners(selectedWinners);
    setRollColumns(columns);
    if (skipAnimation) {
      playAudio(rewardAudioRef.current);
      setOpenPhase("reward");
      return;
    }
    setOpenPhase("intro");
    timersRef.current.push(window.setTimeout(() => setOpenPhase("rolling"), 950));
  };

  const skipOpening = () => {
    clearOpeningTimers();
    if (tickFrameRef.current !== null) window.cancelAnimationFrame(tickFrameRef.current);
    tickFrameRef.current = null;
    playAudio(rewardAudioRef.current);
    setOpenPhase("reward");
  };

  const closeOpening = () => {
    clearOpeningTimers();
    setOpenPhase("idle");
    setRollColumns((columns) => columns.map((column) => ({ ...column, offset: 0 })));
  };

  const finishReward = (message: string) => {
    closeOpening();
    setToast(message);
  };

  const recycleReward = async () => {
    const value = Number(totalRewardValue);
    const credit = await creditLocalBalance(value);
    if (!credit.ok) {
      setToast("回收失败，请先确认账号仍处于登录状态");
      return;
    }
    finishReward(`回收成功，获得 G ${totalRewardValue}`);
  };

  const storeReward = async () => {
    if (!winners.length) return;
    closeOpening();
    try {
      const responses = await Promise.all(winners.map((winner) => fetch("/api/backpack", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "add", boxId: winner.id, itemName: `${winner.weaponName} (${winner.preferredExterior})`, imageUrl: winner.weaponSrc, value: Number(winner.itemValue) }),
        })));
      if (responses.some((response) => !response.ok)) throw new Error("保存失败");
      setToast(`${winners.length} 件奖品已放入背包`);
    } catch {
      setToast("放入背包失败，请稍后重试");
    }
  };

  const totalRewardValue = winners.reduce((sum, item) => sum + Number(item.itemValue), 0).toFixed(2);
  const multiOpening = rollColumns.length > 1;

  return (
    <div className={`classic-shell box-detail-shell detail-tier-${box.tier}`}>
      <header className="classic-topbar">
        <div className="classic-header-inner">
          <button className="classic-brand" type="button" onClick={() => window.location.assign("/")} aria-label="返回首页">
            <Image src="/assets/logo.png" alt="66SKINS" width={336} height={60} priority />
          </button>
          <nav className="classic-nav" aria-label="主导航">
            <button type="button" onClick={() => window.location.assign("/")}><span>⌂</span>首页</button>
            <GameCenterMenu active="classic" buttonClassName="active" onUnavailable={(message) => setToast(message)} />
            <button type="button" onClick={unavailable}><span>▱</span>商城</button>
            <button type="button" onClick={unavailable}><span>↗</span>分享</button>
          </nav>
          <div className="classic-account">
            <SiteUserControls onNotify={(message) => setToast(message)} />
          </div>
        </div>
      </header>

      <RecentDropsStrip />

      <div className="detail-announcement"><span>🔊</span><b>网站公告：</b><p>本地怀旧复刻版不提供充值与发货服务，盲盒开启请理性体验。</p></div>

      <main className="detail-main">
        <section className="opening-stage" aria-labelledby="detail-box-title">
          <div className="stage-ceiling" aria-hidden="true"><span /></div>
          <div className="box-title-plaque" id="detail-box-title">{box.name}</div>
          <button className="detail-back" type="button" onClick={() => window.location.assign("/classic-box")}><b>⇥</b> back</button>

          <div className="chamber" aria-hidden="true">
            <div className="chamber-wall left" />
            <div className="chamber-wall right" />
            <div className="chamber-core" />
            <div className="energy-platform"><i /><i /><i /></div>
          </div>

          <div className="detail-box-art" aria-label={`${box.name}，${box.weaponName}`}>
            {cutoutSrc && <Image className="detail-crate" src={cutoutSrc} alt="" width={1536} height={1024} unoptimized />}
            <Image className="detail-weapon" src={box.weaponSrc} alt={box.weaponName} width={512} height={384} priority />
          </div>

          <div className="opening-controls">
            <div className="quantity-row" role="group" aria-label="开箱数量">
              {[1, 2, 3, 4, 5].map((count) => (
                <button key={count} className={quantity === count ? "active" : ""} type="button" onClick={() => setQuantity(count)}>x{count}</button>
              ))}
            </div>
            <button className="open-box-button" type="button" onClick={startOpening}><span>G</span>{totalPrice}<b>打开</b></button>
          </div>

          <button className="game-help" type="button" onClick={() => setToast("每次开启将从下方物品中随机抽取一件")}><b>?</b> 游戏说明</button>
          <label className="skip-animation"><input type="checkbox" checked={skipAnimation} onChange={(event) => setSkipAnimation(event.target.checked)} /><i />跳过动画</label>
        </section>

        <section className="detail-content">
          <div className="detail-content-head">
            <div className="detail-tabs" role="tablist" aria-label="箱子详情">
              {tabLabels.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} role="tab" aria-selected={activeTab === tab.id} type="button" onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
            </div>
            <div className="probability-legend" aria-label="爆率说明">
              {(["gold", "red", "blue"] as ItemTone[]).map((tone, index) => <span key={tone} className={tone}><i />{legend[index]}%</span>)}
            </div>
          </div>

          <div className="detail-notice"><b>!</b><span>本站所有活动均为本地娱乐模拟。请勿沉迷；禁止利用互动活动进行赌博、欺诈或刷积分等违法违规行为。</span><button type="button" aria-label="关闭提示">×</button></div>

          {activeTab === "items" ? (
            <div className="content-grid">
              {contents.map((item, index) => {
                const tone = getTone(index, contents.length);
                return (
                  <article className={`content-card tone-${tone}`} key={`${item.id}-${index}`}>
                    <span className="content-notch top" /><span className="content-notch bottom" />
                    <Image src={item.weaponSrc} alt={item.weaponName} width={512} height={384} />
                    <div><b><i>G</i>{item.itemValue}</b><span>概率 {(getClassicBoxProbability(index, contents.length) * 100).toFixed(1)}%</span></div>
                    <p>{item.weaponName} ({item.preferredExterior})</p>
                  </article>
                );
              })}
            </div>
          ) : activeTab === "history" ? (
            <RecentBoxDrops boxId={box.id} boxName={box.name} />
          ) : (
            <div className="detail-placeholder" role="tabpanel"><b>{tabLabels.find((tab) => tab.id === activeTab)?.label}</b><span>暂无本地记录，完成开箱功能后将在这里生成数据。</span></div>
          )}
        </section>
      </main>

      {openPhase !== "idle" && (
        <div className={`opening-overlay phase-${openPhase}`} role="dialog" aria-modal="true" aria-label={openPhase === "reward" ? "获得奖励" : "盲盒抽奖动画"}>
          {openPhase === "reward" ? (
            <section className="reward-panel">
              <button className="reward-close" type="button" onClick={closeOpening} aria-label="关闭奖励页面">×</button>
              <div className="reward-rays" aria-hidden="true" />
              <header className="reward-heading"><i /><h2>获得奖励</h2><i /></header>
              <div
                className={`reward-items${winners.length > 1 ? " is-multi" : ""}`}
                style={{ "--reward-count": winners.length } as CSSProperties}
              >
                {winners.map((winner, index) => (
                  <article className="reward-card" key={`${winner.id}-${index}`}>
                    <div className={`reward-item-picture tone-${getTone(contents.indexOf(winner), contents.length)}`}>
                      <Image src={winner.weaponSrc} alt={winner.weaponName} width={512} height={384} />
                    </div>
                    <p>{winner.weaponName} ({winner.preferredExterior})</p>
                    <span>参考价值 G {winner.itemValue}</span>
                  </article>
                ))}
              </div>
              <div className="reward-actions">
                <button className="to-backpack" type="button" onClick={() => void storeReward()}>放入背包</button>
                <button className="recycle" type="button" onClick={recycleReward}>回收 <b>G {totalRewardValue}</b></button>
                <button className="reward-share" type="button" onClick={() => setToast("本地纪念版暂不提供分享")}>分享</button>
              </div>
            </section>
          ) : (
            <section className={`roller-scene${multiOpening ? " multi-roller-scene" : ""}`}>
              <div className={`roller-frame${multiOpening ? " multi-roller-frame" : ""}`}>
                <div className="roller-flash" aria-hidden="true"><i /></div>
                <div className="roller-door left" aria-hidden="true" /><div className="roller-door right" aria-hidden="true" />
                {multiOpening ? (
                  <div
                    className="multi-roller-window"
                    ref={multiRollerRef}
                    style={{ "--open-count": rollColumns.length } as CSSProperties}
                  >
                    {rollColumns.map((column, columnIndex) => (
                      <div className="multi-roller-column" key={`column-${columnIndex}`}>
                        <div
                          className="multi-roller-track"
                          style={{ transform: `translate3d(0, ${column.offset}px, 0)`, transitionDelay: `${columnIndex * 100}ms` }}
                        >
                          {column.items.map((item, itemIndex) => (
                            <div className={`multi-roller-item tone-${getTone(contents.indexOf(item), contents.length)}${openPhase === "settled" && itemIndex === ROLL_TARGET_INDEX ? " is-winning" : ""}`} key={`${item.id}-${itemIndex}`}>
                              <Image src={item.weaponSrc} alt="" width={512} height={384} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="multi-roller-selector" aria-hidden="true"><i /><i /></div>
                  </div>
                ) : (
                  <div className="roller-window" ref={rollerRef}>
                    <div className="roller-track" ref={rollerTrackRef} style={{ transform: `translate3d(${rollColumns[0]?.offset ?? 0}px, 0, 0)` }}>
                      {(rollColumns[0]?.items ?? []).map((item, index) => (
                        <div className={`roller-item tone-${getTone(contents.indexOf(item), contents.length)}${openPhase === "settled" && index === ROLL_TARGET_INDEX ? " is-winning" : ""}`} key={`${item.id}-${index}`}>
                          <Image src={item.weaponSrc} alt="" width={512} height={384} />
                        </div>
                      ))}
                    </div>
                    <div className="roller-selector" aria-hidden="true"><i /><i /></div>
                  </div>
                )}
              </div>
              <button className="animation-skip" type="button" onClick={skipOpening}>跳过动画</button>
            </section>
          )}
        </div>
      )}

      <aside className="classic-tools" aria-label="快捷工具">
        <button className="tool-welfare" type="button" onClick={unavailable}><Image src="/assets/welfare.png" alt="福利中心" width={141} height={80} /></button>
        <button type="button" onClick={unavailable}><b>●</b><span>一键加群</span></button>
        <button type="button" onClick={unavailable}><b>◉</b><span>取回助手</span></button>
        <button type="button" onClick={unavailable}><b>◒</b><span>在线客服</span></button>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><b>↑</b><span>返回顶部</span></button>
      </aside>

      {toast && <SiteToast message={toast} />}
    </div>
  );
}
