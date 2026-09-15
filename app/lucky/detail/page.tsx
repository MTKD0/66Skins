"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RecentDropsStrip } from "../../components/recent-drops-strip";
import { SiteToast } from "../../components/site-toast";
import { GameCenterMenu } from "../../components/game-center-menu";
import { SiteUserControls } from "../../components/site-user-controls";
import { creditLocalBalance, requestLocalLogin, spendLocalBalance } from "../../components/local-wallet";
import { boxes, type ClassicBox } from "../../classic-box/box-data";
import "../../classic-box/classic-box.css";
import "./lucky-detail.css";

type RollPhase = "idle" | "intro" | "rolling" | "settled" | "result";
type HistoryTab = "recent" | "mine";

type Quality = {
  id: string;
  label: string;
  exteriorName: string;
  multiplier: number;
  priceTokens?: number;
  stattrak?: boolean;
  souvenir?: boolean;
};

type MarketVariant = {
  marketHashName: string;
  exteriorName: string | null;
  stattrak: boolean;
  souvenir: boolean;
  priceCny: number;
  priceTokens: number;
  source: string;
};

type AccessoryPriceResponse = {
  item?: { id:string; name:string; imageUrl:string; priceTokens?: number | null };
  variants?: MarketVariant[];
};

type LuckyHistory = {
  id: string;
  itemId: number | string;
  itemName: string;
  imageUrl: string;
  quality: string;
  probability: number;
  success: boolean;
  value: number;
  createdAt: string;
};

const qualities: Quality[] = [
  { id: "battle", label: "战痕累累", exteriorName: "Battle-Scarred", multiplier: 0.72 },
  { id: "field", label: "久经沙场", exteriorName: "Field-Tested", multiplier: 1 },
  { id: "factory", label: "崭新出厂", exteriorName: "Factory New", multiplier: 1.45 },
];

const exteriorLabels: Record<string, string> = {
  "Factory New": "崭新出厂",
  "Minimal Wear": "略有磨损",
  "Field-Tested": "久经沙场",
  "Well-Worn": "破损不堪",
  "Battle-Scarred": "战痕累累",
};

const exteriorOrder = ["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"];

const ROLL_GROUP_SIZE = 20;
const ROLL_GROUPS = 4;
const ROLL_TARGET_INDEX = 67;

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildSequence(probability: number, targetWon: boolean) {
  const successCount = Math.round(probability / 100 * ROLL_GROUP_SIZE);
  const sequence = Array.from({ length: ROLL_GROUPS }, () => shuffle([
    ...Array.from({ length: successCount }, () => true),
    ...Array.from({ length: ROLL_GROUP_SIZE - successCount }, () => false),
  ])).flat();

  if (sequence[ROLL_TARGET_INDEX] !== targetWon) {
    const groupStart = Math.floor(ROLL_TARGET_INDEX / ROLL_GROUP_SIZE) * ROLL_GROUP_SIZE;
    const swapIndex = sequence.findIndex((value, index) => index >= groupStart && index < groupStart + ROLL_GROUP_SIZE && value === targetWon);
    if (swapIndex >= 0) [sequence[ROLL_TARGET_INDEX], sequence[swapIndex]] = [sequence[swapIndex], sequence[ROLL_TARGET_INDEX]];
  }
  return sequence;
}

function playAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}

export default function LuckyDetailPage() {
  const [itemId, setItemId] = useState(8);
  const [accessoryId, setAccessoryId] = useState<string|null>(null);
  const [catalogItem, setCatalogItem] = useState<AccessoryPriceResponse["item"]>(undefined);
  const [qualityId, setQualityId] = useState("battle");
  const [probability, setProbability] = useState(5);
  const [phase, setPhase] = useState<RollPhase>("idle");
  const [sequence, setSequence] = useState<boolean[]>([]);
  const [rollOffset, setRollOffset] = useState(0);
  const [won, setWon] = useState(false);
  const [history, setHistory] = useState<LuckyHistory[]>([]);
  const [historyTab, setHistoryTab] = useState<HistoryTab>("recent");
  const [toast, setToast] = useState("");
  const [baseMarketValue, setBaseMarketValue] = useState<number | null>(null);
  const [marketVariants, setMarketVariants] = useState<MarketVariant[]>([]);
  const rollerViewportRef = useRef<HTMLDivElement>(null);
  const rollerTrackRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const tickFrameRef = useRef<number | null>(null);
  const tickCardIndexRef = useRef<number | null>(null);
  const rollLandingRatioRef = useRef(0);
  const openAudioRef = useRef<HTMLAudioElement | null>(null);
  const tickAudioPoolRef = useRef<HTMLAudioElement[]>([]);
  const tickAudioCursorRef = useRef(0);
  const selectedAudioRef = useRef<HTMLAudioElement | null>(null);
  const rewardAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const searchParams = new URLSearchParams(window.location.search);
      const value = Number(searchParams.get("item"));
      setAccessoryId(searchParams.get("accessory"));
      const previewProbability = Number(searchParams.get("probability"));
      if (boxes.some((entry) => entry.id === value)) setItemId(value);
      if (Number.isInteger(previewProbability) && previewProbability >= 5 && previewProbability <= 95) setProbability(previewProbability);
      try {
        const stored = JSON.parse(window.localStorage.getItem("66skins:lucky-history") ?? "[]") as LuckyHistory[];
        if (Array.isArray(stored)) setHistory(stored.slice(0, 60));
      } catch {
        window.localStorage.removeItem("66skins:lucky-history");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const prepare = (src: string, volume: number) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = volume;
      return audio;
    };
    openAudioRef.current = prepare("/assets/audio/box-open.mp3", 0.7);
    tickAudioPoolRef.current = Array.from({ length: 6 }, () => prepare("/assets/audio/roll-tick.mp3", 0.36));
    selectedAudioRef.current = prepare("/assets/audio/selected.mp3", 0.8);
    rewardAudioRef.current = prepare("/assets/audio/reward.mp3", 0.76);
    const timers = timersRef.current;
    return () => {
      [openAudioRef.current, selectedAudioRef.current, rewardAudioRef.current, ...tickAudioPoolRef.current].forEach((audio) => audio?.pause());
      timers.forEach((timer) => window.clearTimeout(timer));
      if (tickFrameRef.current !== null) window.cancelAnimationFrame(tickFrameRef.current);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = phase === "idle" ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [phase]);

  useEffect(() => {
    if (phase !== "rolling") return;
    const playTick = () => {
      const pool = tickAudioPoolRef.current;
      if (!pool.length) return;
      const audio = pool[tickAudioCursorRef.current % pool.length];
      tickAudioCursorRef.current += 1;
      playAudio(audio);
    };
    const trackCardEdges = () => {
      const viewport = rollerViewportRef.current;
      const track = rollerTrackRef.current;
      const card = track?.querySelector<HTMLElement>(".lucky-roll-card");
      if (!viewport || !track || !card) return;
      const transform = window.getComputedStyle(track).transform;
      const translateX = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
      const currentCardIndex = Math.floor((viewport.clientWidth / 2 - translateX) / card.offsetWidth);
      if (tickCardIndexRef.current !== null && currentCardIndex !== tickCardIndexRef.current) playTick();
      tickCardIndexRef.current = currentCardIndex;
      tickFrameRef.current = window.requestAnimationFrame(trackCardEdges);
    };
    tickCardIndexRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      const viewport = rollerViewportRef.current;
      const card = rollerTrackRef.current?.querySelector<HTMLElement>(".lucky-roll-card");
      if (!viewport || !card) return;
      setRollOffset(viewport.clientWidth / 2 - (ROLL_TARGET_INDEX + 0.5 + rollLandingRatioRef.current) * card.offsetWidth);
      tickFrameRef.current = window.requestAnimationFrame(trackCardEdges);
    });
    const settleTimer = window.setTimeout(() => {
      if (tickFrameRef.current !== null) window.cancelAnimationFrame(tickFrameRef.current);
      tickFrameRef.current = null;
      setPhase("settled");
      playAudio(selectedAudioRef.current);
    }, 4750);
    return () => {
      window.cancelAnimationFrame(frame);
      if (tickFrameRef.current !== null) window.cancelAnimationFrame(tickFrameRef.current);
      tickFrameRef.current = null;
      tickCardIndexRef.current = null;
      window.clearTimeout(settleTimer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "settled") return;
    const resultTimer = window.setTimeout(() => {
      setPhase("result");
      playAudio(rewardAudioRef.current);
    }, 650);
    return () => window.clearTimeout(resultTimer);
  }, [phase]);

  const legacyItem = boxes.find((entry) => entry.id === itemId) ?? boxes[7];
  const item: Omit<ClassicBox,"id"> & {id:number|string} = accessoryId ? {
    ...legacyItem, id:accessoryId, accessoryId, name:catalogItem?.name??"正在读取饰品",
    weaponName:catalogItem?.name??"正在读取饰品", weaponSrc:catalogItem?.imageUrl??"/assets/lucky/mystery-question.png",
    preferredExterior:"", itemValue:"",
  } : legacyItem;

  useEffect(() => {
    let active = true;
    setBaseMarketValue(null);
    setMarketVariants([]);
    setCatalogItem(undefined);
    fetch(`/api/accessories?id=${encodeURIComponent(item.accessoryId)}&variants=1&databaseOnly=1`)
      .then((response) => response.ok ? response.json() as Promise<AccessoryPriceResponse> : Promise.reject())
      .then((payload) => {
        if (!active) return;
        setCatalogItem(payload.item);
        const priceTokens = Number(payload.item?.priceTokens);
        setBaseMarketValue(Number.isFinite(priceTokens) && priceTokens > 0 ? priceTokens : null);
        setMarketVariants(payload.variants ?? []);
      })
      .catch(() => {if(active)setToast("饰品读取失败，请刷新后重试");});
    return () => { active = false; };
  }, [item.accessoryId]);

  const availableQualities = useMemo<Quality[]>(() => {
    const unique = new Map<string, MarketVariant>();
    marketVariants.forEach((variant) => {
      if (variant.priceTokens > 0 && !unique.has(variant.marketHashName)) unique.set(variant.marketHashName, variant);
    });
    return Array.from(unique.values())
      .sort((left, right) => Number(left.stattrak) - Number(right.stattrak)
        || Number(left.souvenir) - Number(right.souvenir)
        || exteriorOrder.indexOf(left.exteriorName ?? "") - exteriorOrder.indexOf(right.exteriorName ?? "")
        || left.priceTokens - right.priceTokens)
      .map((variant) => {
        const prefix = variant.stattrak ? "StatTrak™ · " : variant.souvenir ? "纪念品 · " : "";
        const exteriorName = variant.exteriorName ?? "";
        return {
          id: `market:${variant.marketHashName}`,
          label: `${prefix}${(exteriorLabels[exteriorName] ?? exteriorName) || "标准"}`,
          exteriorName,
          multiplier: 1,
          priceTokens: variant.priceTokens,
          stattrak: variant.stattrak,
          souvenir: variant.souvenir,
        };
      });
  }, [marketVariants]);
  const selectableQualities: Quality[] = availableQualities.length ? availableQualities : baseMarketValue || accessoryId ? [{id:"base",label:"标准",exteriorName:"",multiplier:1,priceTokens:baseMarketValue??undefined}] : qualities;
  const quality = selectableQualities.find((entry) => entry.id === qualityId) ?? selectableQualities[0];

  useEffect(() => {
    if (availableQualities.length && !availableQualities.some((entry) => entry.id === qualityId)) {
      const preferred = availableQualities.find((entry) => entry.label.endsWith(item.preferredExterior) && !entry.stattrak && !entry.souvenir);
      setQualityId((preferred ?? availableQualities[0]).id);
    }
  }, [availableQualities, item.preferredExterior, qualityId]);

  const qualityValue = (entry: Quality) => {
    if (entry.priceTokens != null && entry.priceTokens > 0) return entry.priceTokens;
    const exactVariant = marketVariants.find((variant) => !variant.stattrak && !variant.souvenir
      && variant.exteriorName === entry.exteriorName && variant.priceTokens > 0);
    if (exactVariant) return exactVariant.priceTokens;
    return entry.id === "base" ? baseMarketValue ?? 0 : 0;
  };
  const itemValue = Number(qualityValue(quality).toFixed(2));
  const startPrice = Number((itemValue * (probability / 100) * 1.06).toFixed(2));
  const successLiquidY = 570 - probability * 5.5;
  const failureLiquidY = 570 - (100 - probability) * 5.5;

  const filteredHistory = useMemo(() => history.filter((entry) => {
    if (entry.itemId !== item.id) return false;
    return historyTab === "recent" || entry.quality === quality.label;
  }), [history, historyTab, item.id, quality.label]);

  const notify = (message: string) => {
    setToast("");
    window.setTimeout(() => setToast(message), 0);
  };

  const saveHistory = (success: boolean) => {
    const record: LuckyHistory = {
      id: `lucky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      itemId: item.id,
      itemName: item.weaponName,
      imageUrl: item.weaponSrc,
      quality: quality.label,
      probability,
      success,
      value: itemValue,
      createdAt: new Date().toISOString(),
    };
    setHistory((current) => {
      const next = [record, ...current].slice(0, 60);
      window.localStorage.setItem("66skins:lucky-history", JSON.stringify(next));
      return next;
    });
  };

  const startRoll = async () => {
    if (phase !== "idle") return;
    if (!(itemValue>0) || !(startPrice>0) || !catalogItem) return notify("饰品价格暂不可用，请稍后重试");
    const payment = await spendLocalBalance(startPrice);
    if (!payment.ok) {
      if (payment.error !== "insufficient-balance") requestLocalLogin("请先登录后再参与幸运饰品");
      notify(payment.error === "insufficient-balance" ? `余额不足，本次需要 G ${startPrice.toFixed(2)}` : "请先登录后再参与幸运饰品");
      return;
    }
    const nextWon = Math.random() < probability / 100;
    const nextSequence = buildSequence(probability, nextWon);
    rollLandingRatioRef.current = Math.random() * 0.72 - 0.36;
    setSequence(nextSequence);
    setRollOffset(0);
    setWon(nextWon);
    saveHistory(nextWon);
    setPhase("intro");
    playAudio(openAudioRef.current);
    const timer = window.setTimeout(() => setPhase("rolling"), 650);
    timersRef.current.push(timer);
  };

  const closeResult = () => {
    setPhase("idle");
    setSequence([]);
    setRollOffset(0);
  };

  const addToBackpack = async () => {
    if (!won) return closeResult();
    try {
      const response = await fetch("/api/backpack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "add", accessoryId:item.accessoryId, marketHashName:quality.id.startsWith("market:")?quality.id.slice(7):undefined }),
      });
      if (!response.ok) throw new Error("保存失败");
      closeResult();
      notify("饰品已放入背包");
    } catch {
      notify("暂时无法写入背包，请稍后重试");
    }
  };

  const recycleReward = async () => {
    if (!won) return closeResult();
    const credit = await creditLocalBalance(itemValue);
    if (!credit.ok) {
      notify("回收失败，请先确认账号仍处于登录状态");
      return;
    }
    closeResult();
    notify(`回收成功，获得 G ${itemValue.toFixed(2)}`);
  };

  return (
    <div className="classic-shell lucky-detail-shell">
      <header className="classic-topbar">
        <div className="classic-header-inner">
          <button className="classic-brand" type="button" onClick={() => window.location.assign("/")} aria-label="返回首页"><Image src="/assets/logo.png" alt="66SKINS" width={336} height={60} priority /></button>
          <nav className="classic-nav" aria-label="主导航">
            <button type="button" onClick={() => window.location.assign("/")}><span>⌂</span>首页</button>
            <GameCenterMenu active="lucky" buttonClassName="active" onUnavailable={notify} />
            <button type="button" onClick={() => notify("本地纪念版不提供真实交易与发货")}><span>▱</span>商城</button>
            <button type="button" onClick={() => notify("分享功能将在后续阶段恢复")}><span>↗</span>分享</button>
          </nav>
          <div className="classic-account"><SiteUserControls onNotify={notify} /></div>
        </div>
      </header>

      <RecentDropsStrip />

      <main className="lucky-detail-page">
        <section className="lucky-chamber" aria-label="幸运饰品开箱台">
          <button className="lucky-back" type="button" onClick={() => window.location.assign("/lucky")}>↩ back</button>
          <h1>{item.weaponName}</h1>
          <div className="chamber-corner left">
            <Image className="chamber-item-frame" src="/assets/lucky/lucky-item-frame-v4.png" alt="" width={1904} height={826} priority />
            <Image className="chamber-item-art" src={item.weaponSrc} alt={item.weaponName} width={512} height={384} />
            <span>{quality.label} · {itemValue.toFixed(2)}</span>
          </div>
          <div className="chamber-corner right">
            <Image className="chamber-item-frame" src="/assets/lucky/lucky-item-frame-v4.png" alt="" width={1904} height={826} priority />
            <Image className="chamber-item-art mystery" src="/assets/lucky/mystery-question.png" alt="随机道具" width={512} height={512} />
            <span>随机道具</span>
          </div>
          <div className="probability-side success">
            <svg className="probability-frame-svg" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="success-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="0.34" stopColor="#c8cae8" /><stop offset="0.68" stopColor="#777ba7" /><stop offset="1" stopColor="#f1efff" /></linearGradient>
                <linearGradient id="success-liquid" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#c97500" /><stop offset="0.38" stopColor="#ffbd1f" /><stop offset="0.64" stopColor="#fff08a" /><stop offset="1" stopColor="#e69600" /></linearGradient>
                <clipPath id="success-liquid-level"><rect className="tube-liquid-clip" x="0" y={successLiquidY} width="1000" height={600 - successLiquidY} style={{ "--liquid-y": `${successLiquidY}px`, "--liquid-height": `${600 - successLiquidY}px` } as CSSProperties} /></clipPath>
              </defs>
              <path className="tube-metal-shell" d="M 730 535 H 190 Q 96 535 96 441 V 118 Q 96 62 154 62 H 730" stroke="url(#success-metal)" />
              <path className="tube-metal-rim" d="M 730 535 H 190 Q 96 535 96 441 V 118 Q 96 62 154 62 H 730" />
              <path className="tube-empty-channel" d="M 730 535 H 190 Q 96 535 96 441 V 118 Q 96 62 154 62 H 730" />
              <g clipPath="url(#success-liquid-level)">
                <path className="tube-contained-liquid" d="M 730 535 H 190 Q 96 535 96 441 V 118 Q 96 62 154 62 H 730" stroke="url(#success-liquid)" />
                <path className="tube-liquid-reflection" d="M 730 535 H 190 Q 96 535 96 441 V 118 Q 96 62 154 62 H 730" />
              </g>
            </svg>
            <div className="probability-copy"><b>成功<small>SUCCESS</small></b><strong>{probability}%</strong></div>
          </div>
          <div className="probability-side failure">
            <svg className="probability-frame-svg" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="failure-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="0.34" stopColor="#c8cae8" /><stop offset="0.68" stopColor="#777ba7" /><stop offset="1" stopColor="#f1efff" /></linearGradient>
                <linearGradient id="failure-liquid" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#298ee4" /><stop offset="0.38" stopColor="#62e7ff" /><stop offset="0.66" stopColor="#d6fbff" /><stop offset="1" stopColor="#2295e7" /></linearGradient>
                <clipPath id="failure-liquid-level"><rect className="tube-liquid-clip" x="0" y={failureLiquidY} width="1000" height={600 - failureLiquidY} style={{ "--liquid-y": `${failureLiquidY}px`, "--liquid-height": `${600 - failureLiquidY}px` } as CSSProperties} /></clipPath>
              </defs>
              <path className="tube-metal-shell" d="M 270 535 H 810 Q 904 535 904 441 V 118 Q 904 62 846 62 H 270" stroke="url(#failure-metal)" />
              <path className="tube-metal-rim" d="M 270 535 H 810 Q 904 535 904 441 V 118 Q 904 62 846 62 H 270" />
              <path className="tube-empty-channel" d="M 270 535 H 810 Q 904 535 904 441 V 118 Q 904 62 846 62 H 270" />
              <g clipPath="url(#failure-liquid-level)">
                <path className="tube-contained-liquid" d="M 270 535 H 810 Q 904 535 904 441 V 118 Q 904 62 846 62 H 270" stroke="url(#failure-liquid)" />
                <path className="tube-liquid-reflection" d="M 270 535 H 810 Q 904 535 904 441 V 118 Q 904 62 846 62 H 270" />
              </g>
            </svg>
            <div className="probability-copy"><b>失败<small>FAILURE</small></b><strong>{100 - probability}%</strong></div>
          </div>
          <div className="lucky-capsule" aria-hidden="true"><Image src="/assets/lucky/lucky-pyramid-chest-v2.png" alt="" width={1254} height={1254} priority /></div>
          <div className="probability-control">
            <input type="range" min="5" max="95" step="1" value={probability} onChange={(event) => setProbability(Number(event.target.value))} aria-label="成功概率" style={{ "--probability": `${probability}%` } as CSSProperties} />
            <div className="probability-ticks">{Array.from({ length: 19 }, (_, index) => <i key={index} />)}</div>
          </div>
        </section>

        <button className="lucky-start" type="button" onClick={startRoll}><i>G</i><b>{startPrice.toFixed(2)}</b> 开始</button>

        <div className="lucky-detail-notice"><b>!</b><span>不同品质价格独立计算；连续参与不会累积概率。</span></div>

        <section className="lucky-record-panel">
          <div className="quality-heading"><b>同款品质</b><span>选择品质后，下方显示对应的打开记录</span></div>
          <div className="quality-grid">
            {selectableQualities.map((entry) => {
              const value = qualityValue(entry);
              return <button className={`quality-card${qualityId === entry.id ? " active" : ""}`} type="button" key={entry.id} onClick={() => { setQualityId(entry.id); setHistoryTab("mine"); }}><Image src={item.weaponSrc} alt="" width={512} height={384} /><b>{entry.label}</b><span>{item.weaponName}</span><strong><i>G</i>{value.toFixed(2)}</strong></button>;
            })}
          </div>

          <div className="record-tabs" role="tablist" aria-label="打开记录">
            <button className={historyTab === "recent" ? "active" : ""} type="button" onClick={() => setHistoryTab("recent")}>最近掉落</button>
            <button className={historyTab === "mine" ? "active" : ""} type="button" onClick={() => setHistoryTab("mine")}>历史掉落 · {quality.label}</button>
          </div>
          <div className="history-strip">
            {filteredHistory.slice(0, 20).map((entry) => <article className={entry.success ? "success" : "failure"} key={entry.id}><div><Image src="/assets/default-avatar.png" alt="本地玩家" width={60} height={60} /><b>{entry.probability}%</b></div><Image src={entry.success ? entry.imageUrl : "/assets/lucky/mystery-question.png"} alt={entry.success ? entry.itemName : "未获得"} width={180} height={130} /><span>{entry.success ? entry.quality : "未获得饰品"}</span><time>{new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></article>)}
            {!filteredHistory.length && <div className="history-empty"><Image src="/assets/lucky/mystery-question.png" alt="" width={130} height={130} /><b>还没有打开记录</b><span>选择概率并开始一次后，结果会保存在本机。</span></div>}
          </div>
        </section>
      </main>

      <aside className="classic-tools" aria-label="快捷工具"><button className="tool-welfare" type="button" onClick={() => notify("福利中心暂未开放")}><Image src="/assets/welfare.png" alt="福利中心" width={141} height={80} /></button><button type="button" onClick={() => notify("本地纪念版暂不提供群聊服务")}><b>●</b><span>一键加群</span></button><button type="button" onClick={() => notify("取回助手将在后续恢复")}><b>◉</b><span>取回助手</span></button><button type="button" onClick={() => notify("在线客服功能暂未开放")}><b>◒</b><span>在线客服</span></button><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><b>↑</b><span>返回顶部</span></button></aside>

      {phase !== "idle" && (
        <div className={`lucky-roll-overlay phase-${phase}`}>
          {phase !== "result" ? <div className="lucky-roll-scene"><div className="lucky-roll-frame"><div className="lucky-roll-window" ref={rollerViewportRef}><div className="lucky-roll-track" ref={rollerTrackRef} style={{ transform: `translateX(${rollOffset}px)` }}>{sequence.map((isSuccess, index) => <div className={`lucky-roll-card ${isSuccess ? "is-success" : "is-question"}${phase === "settled" && index === ROLL_TARGET_INDEX ? " selected" : ""}`} key={index}><Image src={isSuccess ? item.weaponSrc : "/assets/lucky/mystery-question.png"} alt={isSuccess ? item.weaponName : "随机问号"} width={300} height={240} /></div>)}</div></div><div className="lucky-roll-door left" /><div className="lucky-roll-door right" /><div className="lucky-roll-flash"><i /></div><div className="lucky-roll-selector" /></div></div> : <section className={`lucky-result ${won ? "won" : "lost"}`}><button className="result-close" type="button" onClick={closeResult}>×</button><div className="result-rays" /><h2>{won ? "获得奖励" : "本次未获得"}</h2><div className="result-card"><Image src={won ? item.weaponSrc : "/assets/lucky/mystery-question.png"} alt={won ? item.weaponName : "未获得"} width={500} height={380} /><b>{won ? item.weaponName : "随机道具"}</b><span>{won ? `${quality.label} · G ${itemValue.toFixed(2)}` : `${probability}% 概率未命中`}</span></div><div className="result-actions">{won ? <><button type="button" onClick={addToBackpack}>放入背包</button><button type="button" onClick={recycleReward}>回收 <b>G {itemValue.toFixed(2)}</b></button></> : <button className="try-again" type="button" onClick={closeResult}>返回重试</button>}</div></section>}
        </div>
      )}

      {toast && <SiteToast message={toast} />}
    </div>
  );
}
