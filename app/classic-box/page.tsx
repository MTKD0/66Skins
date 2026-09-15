"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { SiteToast } from "../components/site-toast";
import { GameCenterMenu } from "../components/game-center-menu";
import { SiteUserControls } from "../components/site-user-controls";
import { boxAssets, boxes } from "./box-data";
import "./classic-box.css";

const cutoutCache = new Map<string, Promise<string>>();

function createTransparentCutout(src: string) {
  const cached = cutoutCache.get(src);
  if (cached) return cached;

  const cutout = new Promise<string>((resolve, reject) => {
    const source = new window.Image();
    source.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("Canvas is not available"));
        return;
      }

      context.drawImage(source, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const values = pixels.data;

      for (let index = 0; index < values.length; index += 4) {
        const brightest = Math.max(values[index], values[index + 1], values[index + 2]);
        if (brightest <= 4) {
          values[index + 3] = 0;
        } else if (brightest < 26) {
          const edgeAlpha = Math.pow((brightest - 4) / 22, 0.72);
          values[index + 3] = Math.round(values[index + 3] * edgeAlpha);
        }
      }

      context.putImageData(pixels, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Cutout could not be created"));
          return;
        }
        resolve(URL.createObjectURL(blob));
      }, "image/png");
    };
    source.onerror = () => reject(new Error(`Could not load ${src}`));
    source.src = src;
  });

  cutoutCache.set(src, cutout);
  return cutout;
}

function BoxArt({ src, weaponSrc, weaponName }: { src: string; weaponSrc: string; weaponName: string }) {
  const [cutoutSrc, setCutoutSrc] = useState("");

  useEffect(() => {
    let active = true;
    createTransparentCutout(src)
      .then((result) => {
        if (active) setCutoutSrc(result);
      })
      .catch(() => {
        if (active) setCutoutSrc(src);
      });
    return () => {
      active = false;
    };
  }, [src]);

  return (
    <span className={`box-art${cutoutSrc ? " is-ready" : ""}`} aria-hidden="true">
      {cutoutSrc && <Image className="crate-image" src={cutoutSrc} alt="" width={1536} height={1024} unoptimized />}
      <span className="weapon-slot">
        <Image className="weapon-image" src={weaponSrc} alt={weaponName} width={512} height={384} />
      </span>
    </span>
  );
}


export default function ClassicBoxPage() {
  const [toast, setToast] = useState("");
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [marketPrices, setMarketPrices] = useState<Record<number, number>>({});

  useEffect(() => {
    let active = true;
    fetch("/api/classic-boxes")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("价格读取失败")))
      .then((payload: { values?: Array<{ boxId: number; boxPrice: number }> }) => {
        if (active) setMarketPrices(Object.fromEntries((payload.values ?? []).map((entry) => [entry.boxId, entry.boxPrice])));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const unavailable = () => setToast("暂未开放");
  const selectBox = (id: number) => {
    setSelectedBox(id);
    window.location.assign(`/classic-box/detail?box=${id}`);
  };

  return (
    <div className="classic-shell">
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

      <main className="classic-page">
        <div className="classic-tabs" role="tablist" aria-label="经典盲盒页面">
          <button className="active" role="tab" aria-selected="true" type="button">经典盲盒</button>
          <button role="tab" aria-selected="false" type="button" onClick={unavailable}>掉落记录</button>
        </div>

        <section className="classic-panel">
          <div className="classic-title" aria-label="经典盲盒"><i /><h1>经典盲盒</h1><i /></div>
          <div className="classic-grid">
            {boxes.map((box) => {
              const displayPrice = marketPrices[box.id] > 0 ? marketPrices[box.id].toFixed(2) : "待更新";
              return (
              <button className={`classic-card tier-${box.tier}${selectedBox === box.id ? " is-selected" : ""}`} type="button" key={box.id} onClick={() => selectBox(box.id)} aria-pressed={selectedBox === box.id} aria-label={`${box.name}，${box.weaponName}，价格 ${displayPrice}`}>
                <span className="card-notch top" aria-hidden="true" />
                <span className="card-notch bottom" aria-hidden="true" />
                <BoxArt src={boxAssets[box.tier]} weaponSrc={box.weaponSrc} weaponName={box.weaponName} />
                <span className="box-name">{box.name}</span>
                <span className="box-price"><i>G</i>{displayPrice}</span>
              </button>
            ); })}
          </div>
        </section>
      </main>

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
