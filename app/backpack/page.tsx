"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteToast } from "../components/site-toast";
import { GameCenterMenu } from "../components/game-center-menu";
import { SiteUserControls, useLocalUser } from "../components/site-user-controls";
import { creditLocalBalance, requestLocalLogin } from "../components/local-wallet";
import "../classic-box/classic-box.css";
import "./backpack.css";

type BackpackItem = {
  id: string;
  boxId: number;
  itemName: string;
  imageUrl: string;
  value: number;
  acquiredAt: string;
  status: string;
};

type RecycleRecord = {
  id: string;
  backpackItemId: string;
  itemName: string;
  imageUrl: string;
  value: number;
  recycledAt: string;
};

type ToastState = { message: string; variant: "success" | "info" | "error" } | null;

export default function BackpackPage() {
  const [items, setItems] = useState<BackpackItem[]>([]);
  const [history, setHistory] = useState<RecycleRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState("newest");
  const [activeTab, setActiveTab] = useState<"items" | "history">("items");
  const [tradeUrl, setTradeUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const { user } = useLocalUser();

  const notify = useCallback((message: string, variant: "success" | "info" | "error" = "info") => {
    setToast({ message, variant });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/backpack?sort=${encodeURIComponent(sort)}`);
      const data = await response.json() as { items?: BackpackItem[]; tradeUrl?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "读取失败");
      setItems(data.items ?? []);
      setTradeUrl(data.tradeUrl ?? "");
    } catch {
      notify("背包读取失败", "error");
    } finally {
      setLoading(false);
    }
  }, [notify, sort]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/backpack?view=history");
      const data = await response.json() as { records?: RecycleRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "读取失败");
      setHistory(data.records ?? []);
    } catch {
      notify("回收记录读取失败", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { void loadItems(); }, [loadItems]);
  useEffect(() => { if (activeTab === "history") void loadHistory(); }, [activeTab, loadHistory]);

  const selectedItems = useMemo(() => items.filter((item) => selected.has(item.id)), [items, selected]);
  const selectedValue = selectedItems.reduce((sum, item) => sum + Number(item.value), 0);

  const toggleItem = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((item) => item.id)));

  const saveSteamTradeUrl = async () => {
    try {
      const response = await fetch("/api/backpack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save-trade-url", tradeUrl }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      notify("交易链接保存成功", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "保存失败", "error");
    }
  };

  const recycleSelected = async () => {
    if (!selected.size) return notify("请先选择需要回收的饰品");
    if (!user) {
      requestLocalLogin("请先登录后再回收饰品");
      return notify("请先登录后再回收饰品", "error");
    }
    try {
      const response = await fetch("/api/backpack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "recycle", ids: [...selected] }) });
      const data = await response.json() as { count?: number; totalValue?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "回收失败");
      const totalValue = Number(data.totalValue ?? 0);
      const credit = { ok: true }; window.dispatchEvent(new Event("66skins:user-change"));
      if (!credit.ok) throw new Error("余额返还失败，请重新登录后再试");
      setSelected(new Set());
      await loadItems();
      notify(`回收成功，余额增加 G ${totalValue.toFixed(2)}`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "回收失败", "error");
    }
  };

  return (
    <div className="classic-shell backpack-shell">
      <header className="classic-topbar">
        <div className="classic-header-inner">
          <button className="classic-brand" type="button" onClick={() => window.location.assign("/")} aria-label="返回首页"><Image src="/assets/logo.png" alt="66SKINS" width={336} height={60} priority /></button>
          <nav className="classic-nav" aria-label="主导航">
            <button type="button" onClick={() => window.location.assign("/")}><span>⌂</span>首页</button>
            <GameCenterMenu onUnavailable={(message) => notify(message)} />
            <button type="button" onClick={() => notify("本地纪念版不提供真实商城")}><span>▱</span>商城</button>
            <button type="button" onClick={() => notify("本地纪念版暂不提供分享")}><span>↗</span>分享</button>
          </nav>
          <div className="classic-account"><SiteUserControls backpackActive onNotify={(message) => notify(message)} /></div>
        </div>
      </header>

      <main className="backpack-page">
        <aside className="profile-panel">
          <div className="profile-avatar"><Image src="/assets/default-avatar.png" alt="用户头像" width={140} height={140} /></div>
          <b className="profile-name">{user?.username ?? "未登录"}</b><span className="profile-id">{user ? `本地余额 G ${user.balance.toFixed(2)}` : "登录后查看本地账户"}</span>
          <div className="profile-icons"><i>⇩</i><i>♟</i><i>◉</i></div>
          <nav>
            <button type="button">个人资料</button><button type="button">积分福利</button><button className="active" type="button">我的背包</button><button type="button">钱包记录</button><button type="button">钱包充值</button><button type="button">推广分享</button><button type="button">高光时刻</button>
          </nav>
        </aside>

        <div className="backpack-workspace">
          <section className="trade-settings">
            <h1><i />steam交易设置 <span /></h1>
            <div className="trade-row"><input value={tradeUrl} onChange={(event) => setTradeUrl(event.target.value)} placeholder="https://steamcommunity.com/tradeoffer/new/?partner=...&token=..." aria-label="Steam 交易链接" /><button type="button" onClick={() => void saveSteamTradeUrl()}>保存</button></div>
            <p>小提示：本地纪念版只保存链接格式，不会向 Steam 发起交易或发送饰品。</p>
          </section>

          <section className="inventory-panel">
            <div className="inventory-tabs" role="tablist"><button className={activeTab === "items" ? "active" : ""} type="button" role="tab" aria-selected={activeTab === "items"} onClick={() => setActiveTab("items")}>背包</button><button className={activeTab === "history" ? "active" : ""} type="button" role="tab" aria-selected={activeTab === "history"} onClick={() => setActiveTab("history")}>取回记录</button><button className="refresh-inventory" type="button" onClick={() => void (activeTab === "items" ? loadItems() : loadHistory())} aria-label="刷新">↻</button></div>

            {activeTab === "items" ? (
              <>
                <div className="inventory-toolbar"><span>件数：<b>{items.length}</b></span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="背包排序"><option value="newest">按获得时间排序</option><option value="oldest">最早获得</option><option value="value-desc">价格从高到低</option><option value="value-asc">价格从低到高</option></select><label><input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} />全选</label></div>
                <div className="inventory-layout">
                  <div className="inventory-grid">
                    {loading ? <div className="inventory-empty">正在读取背包…</div> : items.length ? items.map((item) => <button className={`inventory-card${selected.has(item.id) ? " selected" : ""}`} type="button" key={item.id} onClick={() => toggleItem(item.id)}><span className="inventory-check">✓</span><Image src={item.imageUrl} alt={item.itemName} width={512} height={384} /><p>{item.itemName}</p><b><i>G</i>{Number(item.value).toFixed(2)}</b></button>) : <div className="inventory-empty">背包还是空的，通过经典盲盒获得的饰品会出现在这里。</div>}
                  </div>
                  <aside className="selected-tray"><h2>已经选择 <b>{selected.size}</b></h2><div>{selectedItems.map((item) => <span key={item.id}><Image src={item.imageUrl} alt="" width={80} height={60} />{item.itemName}</span>)}</div><footer><p>合计 G {selectedValue.toFixed(2)}</p><button type="button" onClick={() => notify("本地纪念版不提供真实饰品取回")}>取回饰品</button><button type="button" onClick={() => void recycleSelected()}>回收</button></footer></aside>
                </div>
              </>
            ) : (
              <div className="history-list">{loading ? <div className="inventory-empty">正在读取记录…</div> : history.length ? history.map((record) => <article key={record.id}><Image src={record.imageUrl} alt="" width={100} height={74} /><span><b>{record.itemName}</b><small>{new Date(record.recycledAt).toLocaleString("zh-CN")}</small></span><strong>回收 G {Number(record.value).toFixed(2)}</strong></article>) : <div className="inventory-empty">暂无回收记录</div>}</div>
            )}
          </section>
        </div>
      </main>

      <aside className="classic-tools" aria-label="快捷工具"><button className="tool-welfare" type="button" onClick={() => notify("福利中心暂未开放")}><Image src="/assets/welfare.png" alt="福利中心" width={141} height={80} /></button><button type="button" onClick={() => notify("本地纪念版暂不提供加群")}><b>●</b><span>一键加群</span></button><button type="button" onClick={() => notify("取回助手暂未开放")}><b>◉</b><span>取回助手</span></button><button type="button" onClick={() => notify("在线客服暂未开放")}><b>◒</b><span>在线客服</span></button><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><b>↑</b><span>返回顶部</span></button></aside>
      {toast && <SiteToast message={toast.message} variant={toast.variant} />}
    </div>
  );
}
