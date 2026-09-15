"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { RecentDropsStrip } from "../components/recent-drops-strip";
import { SiteToast } from "../components/site-toast";
import { GameCenterMenu } from "../components/game-center-menu";
import { SiteUserControls } from "../components/site-user-controls";
import type { LuckyAccessory } from "@/db/lucky-accessories";
import "../classic-box/classic-box.css";
import "./lucky.css";

type Category = {
  id: string;
  label: string;
  image?: string;
  symbol?: string;
};

type CatalogResponse = {rows: LuckyAccessory[]; total: number; page: number; pageSize: number; types: string[]};

const categories: Category[] = [
  { id: "recommend", label: "推荐", symbol: "👍" },
  { id: "glove", label: "手套", symbol: "✦" },
  { id: "knife", label: "匕首", image: "/assets/classic-box/weapons/weapon-15.png" },
  { id: "pistol", label: "手枪", image: "/assets/classic-box/weapons/weapon-03.png" },
  { id: "smg", label: "微型冲锋枪", image: "/assets/classic-box/weapons/weapon-05.png" },
  { id: "rifle", label: "步枪", image: "/assets/classic-box/weapons/weapon-07.png" },
  { id: "sniper", label: "狙击枪", image: "/assets/classic-box/weapons/weapon-08.png" },
  { id: "ultimate", label: "重型武器", image: "/assets/classic-box/weapons/weapon-09.png" },
];

const knifeTypes = ["推荐", "爪子刀", "M9 刺刀", "蝴蝶刀", "折叠刀", "熊刀", "折刀"];
const ranges = [
  { label: "0 - 200", min: 0, max: 200 },
  { label: "200 - 500", min: 200, max: 500 },
  { label: "500 - 1000", min: 500, max: 1000 },
  { label: "1000 - 2000", min: 1000, max: 2000 },
];

export default function LuckyPage() {
  const [activeTab, setActiveTab] = useState<"hot" | "history" | "stats">("hot");
  const [category, setCategory] = useState("knife");
  const [knifeType, setKnifeType] = useState("");
  const [range, setRange] = useState<string | null>(null);
  const [minDraft, setMinDraft] = useState("");
  const [maxDraft, setMaxDraft] = useState("");
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [ascending, setAscending] = useState(true);
  const [toast, setToast] = useState("");
  const [catalog, setCatalog] = useState<CatalogResponse>({rows:[],total:0,page:0,pageSize:20,types:knifeTypes.slice(1)});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setLoadError("");
    const params = new URLSearchParams({category, weapon:knifeType, q:nameQuery, sort:ascending?"asc":"desc", page:String(page)});
    if(minPrice!==null)params.set("min",String(minPrice));
    if(maxPrice!==null)params.set("max",String(maxPrice));
    fetch("/api/lucky-accessories?"+params, {signal:controller.signal,cache:"no-store"})
      .then(async response => {if(!response.ok)throw new Error("饰品加载失败，请重试");return response.json() as Promise<CatalogResponse>;})
      .then((payload) => {
        if (!active) return;
        setCatalog(payload);
      })
      .catch(error => {if(active)setLoadError(error instanceof Error?error.message:"饰品加载失败，请重试");})
      .finally(()=>{if(active)setLoading(false);});
    return () => { active = false; controller.abort(); };
  }, [category,knifeType,nameQuery,ascending,page,minPrice,maxPrice,retry]);
  const accessories = catalog.rows;

  const notify = (message: string) => {
    setToast("");
    window.setTimeout(() => setToast(message), 0);
  };

  const chooseRange = (label: string, min: number, max: number) => {
    setPage(0);
    const next = range === label ? null : label;
    setRange(next);
    setMinPrice(next ? min : null);
    setMaxPrice(next ? max : null);
    setMinDraft("");
    setMaxDraft("");
  };

  const searchPrice = () => {
    const min = minDraft === "" ? null : Number(minDraft);
    const max = maxDraft === "" ? null : Number(maxDraft);
    if ((min!==null&&(!Number.isFinite(min)||min<0))||(max!==null&&(!Number.isFinite(max)||max<0))) return notify("请输入有效的非负价格");
    if (min != null && max != null && min > max) return notify("最低价格不能高于最高价格");
    setRange(null);
    setPage(0);
    setMinPrice(Number.isFinite(min) ? min : null);
    setMaxPrice(Number.isFinite(max) ? max : null);
  };

  return (
    <div className="classic-shell lucky-shell">
      <header className="classic-topbar">
        <div className="classic-header-inner">
          <button className="classic-brand" type="button" onClick={() => window.location.assign("/")} aria-label="返回首页">
            <Image src="/assets/logo.png" alt="66SKINS" width={336} height={60} priority />
          </button>
          <nav className="classic-nav" aria-label="主导航">
            <button type="button" onClick={() => window.location.assign("/")}><span>⌂</span>首页</button>
            <GameCenterMenu active="lucky" buttonClassName="active" onUnavailable={notify} />
            <button type="button" onClick={() => notify("本地纪念版不提供真实交易与发货")}><span>▱</span>商城</button>
            <button type="button" onClick={() => notify("分享功能将在后续阶段恢复")}><span>↗</span>分享</button>
          </nav>
          <div className="classic-account">
            <SiteUserControls onNotify={notify} />
          </div>
        </div>
      </header>

      <RecentDropsStrip />

      <main className="lucky-page">
        <div className="lucky-tabs" role="tablist" aria-label="幸运饰品栏目">
          <button className={activeTab === "hot" ? "active" : ""} role="tab" aria-selected={activeTab === "hot"} type="button" onClick={() => setActiveTab("hot")}>热门道具</button>
          <button className={activeTab === "history" ? "active" : ""} role="tab" aria-selected={activeTab === "history"} type="button" onClick={() => setActiveTab("history")}>掉落记录</button>
          <button className={activeTab === "stats" ? "active" : ""} role="tab" aria-selected={activeTab === "stats"} type="button" onClick={() => setActiveTab("stats")}>全局统计</button>
        </div>

        {activeTab === "hot" ? (
          <>
            <section className="lucky-category-panel" aria-label="道具大类">
              <div className="lucky-category-row">
                {categories.map((item) => (
                  <button className={`lucky-category${category === item.id ? " active" : ""}`} type="button" key={item.id} onClick={() => {if(category!==item.id)setCatalog(current=>({...current,types:[]}));setCategory(item.id);setKnifeType("");setPage(0);}} aria-pressed={category === item.id}>
                    <span className="category-art">
                      {item.image ? <Image src={item.image} alt="" width={512} height={384} /> : <i>{item.symbol}</i>}
                    </span>
                    <b>{item.label}</b>
                  </button>
                ))}
              </div>
            </section>

            <nav className="lucky-subtypes" aria-label="具体武器类型">
              <button className={!knifeType?"active":""} type="button" aria-pressed={!knifeType} onClick={()=>{setKnifeType("");setPage(0);}}>全部</button>
              {catalog.types.map((item) => <button className={knifeType === item ? "active" : ""} type="button" key={item} aria-pressed={knifeType === item} onClick={() => {setKnifeType(item);setPage(0);}}>{item}</button>)}
            </nav>

            <section className="lucky-filters" aria-label="饰品筛选">
              <div className="quick-ranges">
                {ranges.map((item) => <button className={range === item.label ? "active" : ""} type="button" key={item.label} onClick={() => chooseRange(item.label, item.min, item.max)}>{item.label}</button>)}
              </div>
              <button className="lucky-sort" type="button" onClick={() => {setAscending((value) => !value);setPage(0);}}><i>☷</i>{ascending ? "价格从低到高" : "价格从高到低"}</button>
              <div className="price-search">
                <input inputMode="decimal" value={minDraft} onChange={(event) => setMinDraft(event.target.value.replace(/[^\d.]/g, ""))} placeholder="最低价格" aria-label="最低价格" />
                <span>–</span>
                <input inputMode="decimal" value={maxDraft} onChange={(event) => setMaxDraft(event.target.value.replace(/[^\d.]/g, ""))} placeholder="最高价格" aria-label="最高价格" />
                <button type="button" onClick={searchPrice}>搜索</button>
              </div>
              <div className="name-search">
                <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") {setNameQuery(nameDraft.trim());setPage(0);} }} placeholder="请输入道具名称" aria-label="道具名称" />
                <button type="button" onClick={() => {setNameQuery(nameDraft.trim());setPage(0);}}>搜索</button>
              </div>
            </section>

            <div className="lucky-results-summary" aria-live="polite"><span>{loading?"正在筛选饰品…":loadError?"饰品暂不可用":`共 ${catalog.total} 件饰品`}</span><button type="button" onClick={()=>{setKnifeType("");setRange(null);setMinDraft("");setMaxDraft("");setMinPrice(null);setMaxPrice(null);setNameDraft("");setNameQuery("");setPage(0);}}>清除筛选</button></div>
            <section className="lucky-grid" aria-label="幸运饰品列表" aria-busy={loading}>
              {!loading&&!loadError&&accessories.map((item) => (
                <button className="lucky-item-card" type="button" key={item.id} disabled={!(Number(item.priceTokens)>0)} onClick={() => window.location.assign(`/lucky/detail?accessory=${encodeURIComponent(item.id)}`)}>
                  <span className="lucky-card-notch top" /><span className="lucky-card-notch bottom" />
                  <Image src={item.imageUrl} alt={item.name} width={512} height={384} />
                  <b>{item.name}</b>
                  <span>{item.priceTokens!==null&&item.priceTokens>0?<><i>G</i>{item.priceTokens.toFixed(2)}</>:"价格暂不可用"}</span>
                </button>
              ))}
              {loading?<div className="lucky-empty" role="status">正在加载饰品…</div>:loadError?<div className="lucky-empty" role="alert">{loadError} <button type="button" onClick={()=>setRetry(value=>value+1)}>重试</button></div>:!accessories.length&&<div className="lucky-empty">没有符合当前筛选条件的饰品</div>}
            </section>
            {!loadError&&<nav className="lucky-pagination" aria-label="饰品分页"><button disabled={loading||catalog.page===0} onClick={()=>setPage(catalog.page-1)}>上一页</button><span>第 {catalog.page+1} / {Math.max(1,Math.ceil(catalog.total/catalog.pageSize))} 页</span><button disabled={loading||(catalog.page+1)*catalog.pageSize>=catalog.total} onClick={()=>setPage(catalog.page+1)}>下一页</button></nav>}
          </>
        ) : (
          <section className="lucky-tab-placeholder">
            <b>{activeTab === "history" ? "掉落记录" : "全局统计"}</b>
            <span>{activeTab === "history" ? "暂无掉落记录" : "暂无统计数据"}</span>
          </section>
        )}
      </main>

      <aside className="classic-tools" aria-label="快捷工具">
        <button className="tool-welfare" type="button" onClick={() => notify("福利中心暂未开放")}><Image src="/assets/welfare.png" alt="福利中心" width={141} height={80} /></button>
        <button type="button" onClick={() => notify("本地纪念版暂不提供群聊服务")}><b>●</b><span>一键加群</span></button>
        <button type="button" onClick={() => notify("取回助手将在后续恢复")}><b>◉</b><span>取回助手</span></button>
        <button type="button" onClick={() => notify("在线客服功能暂未开放")}><b>◒</b><span>在线客服</span></button>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><b>↑</b><span>返回顶部</span></button>
      </aside>

      {toast && <SiteToast message={toast} />}
    </div>
  );
}
