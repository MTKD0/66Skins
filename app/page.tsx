"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { RecentDropsStrip } from "./components/recent-drops-strip";
import { SiteToast } from "./components/site-toast";
import { GameCenterMenu } from "./components/game-center-menu";
import { SiteUserControls } from "./components/site-user-controls";

const entries = [
  { name: "经典盲盒", image: "/assets/entry-box-default.png", hoverImage: "/assets/entry_box_sel.8aa9d115.png", href: "/classic-box", message: "进入经典盲盒" },
  { name: "幸运饰品", image: "/assets/entry-lucky-default.png", hoverImage: "/assets/entry_lucky_sel.ddb223e2.png", href: "/lucky", message: "进入幸运饰品" },
  { name: "ROLL房", image: "/assets/entry_roll.9b9e122b.png", hoverImage: "/assets/entry_roll_sel.27d9524c.png", message: "ROLL房玩法将在下一阶段恢复" },
  { name: "商城", image: "/assets/entry_hot.7e3d0e1d.png", hoverImage: "/assets/entry_hot_sel.51a74737.png", message: "本地纪念版不提供真实交易与发货" },
] as const;

function EntryCard({ entry, onOpen }: { entry: (typeof entries)[number]; onOpen: (message: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const source = hovered && "hoverImage" in entry ? entry.hoverImage : entry.image;
  return (
    <button className="entry-card" type="button" aria-label={`进入${entry.name}`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} onClick={() => "href" in entry ? window.location.assign(entry.href) : onOpen(entry.message)}>
      <Image src={source} alt={entry.name} width={300} height={312} priority />
    </button>
  );
}

export default function Home() {
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const localOnly = (message: string) => setToast(message);

  return (
    <div className="site-shell">
      <header className="topbar">
        <div className="header-inner">
          <button className="brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="66SKINS 首页">
            <Image src="/assets/logo.png" alt="66SKINS" width={336} height={60} priority />
          </button>
          <nav className="main-nav" aria-label="主导航">
            <button className="nav-item active" type="button"><span className="nav-icon">⌂</span>首页</button>
            <GameCenterMenu buttonClassName="nav-item" onUnavailable={localOnly} />
            <button className="nav-item" type="button" onClick={() => localOnly("本地纪念版不提供真实交易与发货")}><span className="nav-icon">▱</span>商城</button>
            <button className="nav-item" type="button" onClick={() => localOnly("当前页面仅在你的电脑本地运行")}><span className="nav-icon">↗</span>分享</button>
          </nav>
          <div className="account-area">
            <SiteUserControls onNotify={localOnly} />
          </div>
        </div>
      </header>

      <RecentDropsStrip />

      <main className="home-stage">
        <div className="city-background" aria-hidden="true" />
        <section className="announcement" aria-label="网站公告">
          <span className="speaker" aria-hidden="true">◖</span><span>网站公告：</span>
          <span className="announcement-copy">欢迎回到 66SKINS 本地纪念版，所有内容均为离线演示。</span>
        </section>
        <section className="event-hero" aria-label="每日幸运玩家活动">
          <div className="event-art-blur" aria-hidden="true" />
          <div className="event-copy">
            <p className="event-kicker">DAILY BENEFITS<br />RANDOM RED ENVELOPE</p>
            <div className="event-heading">
              <h1><span>每日</span><strong>幸运玩家</strong></h1>
              <button type="button" onClick={() => localOnly("每日幸运玩家活动将在玩法阶段开放")}>立即<br />参与</button>
            </div>
            <div className="event-subtitle">
              <b>活动</b>
              <span>EASTER EGG<br />LUCKY PLAYERS <i>»</i></span>
            </div>
          </div>
          <button className="hero-next" type="button" aria-label="下一张活动图" onClick={() => localOnly("更多活动图将在后续补充")}>›</button>
          <div className="hero-pagination" aria-hidden="true"><i /><span /><span /></div>
        </section>
        <section className="entry-section" aria-label="快捷入口">
          <button className="carousel-arrow left" type="button" aria-label="上一组">‹</button>
          <div className="entry-list">{entries.map((entry) => <EntryCard key={entry.name} entry={entry} onOpen={localOnly} />)}</div>
          <button className="carousel-arrow right" type="button" aria-label="下一组">›</button>
        </section>
      </main>

      <aside className="side-tools" aria-label="快捷工具">
        <button className="welfare" type="button" onClick={() => localOnly("福利中心仅保留界面展示")}><Image src="/assets/welfare.png" alt="福利中心" width={141} height={80} /></button>
        <button type="button" onClick={() => localOnly("本地纪念版不会连接外部群聊")}><span className="tool-icon chat-icon" aria-hidden="true" /><span>一键加群</span></button>
        <button type="button" onClick={() => localOnly("取回助手在本地纪念版中已停用")}><span className="tool-icon steam-icon" aria-hidden="true">◉</span><span>取回助手</span></button>
        <button type="button" onClick={() => localOnly("本地纪念版不连接在线客服")}><span className="tool-icon service-icon" aria-hidden="true">◒</span><span>在线客服</span></button>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><span className="tool-icon up-icon" aria-hidden="true">↑</span><span>返回顶部</span></button>
      </aside>

      {noticeOpen && (
        <div className="notice-overlay" role="dialog" aria-modal="true" aria-labelledby="notice-title">
          <div className="notice-dialog">
            <button className="notice-close" type="button" onClick={() => setNoticeOpen(false)} aria-label="关闭提示">×</button>
            <h1 id="notice-title">盲盒消费提示</h1><div className="notice-divider" />
            <div className="notice-body">
              <p className="warning">※ 盲盒游戏中不同饰品设有不同获得概率，并不是百分之百掉落</p>
              <p className="warning">某一饰品，请理性消费！详情参考游戏板块说明。</p>
              <p>※ 网站禁止未成年人消费</p>
              <p>※ 官方网址：<span>www.66skins.com</span></p>
              <p>※ 备用网址：<span className="muted">www.66skins.cn</span></p>
            </div>
            <button className="confirm-button" type="button" onClick={() => setNoticeOpen(false)}>确定</button>
          </div>
        </div>
      )}
      {toast && <SiteToast message={toast} />}
    </div>
  );
}
