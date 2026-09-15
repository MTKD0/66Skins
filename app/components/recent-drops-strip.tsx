"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

export type RecentDrop = {
  id: string;
  boxId: number;
  boxName: string;
  boxImageUrl: string;
  itemId: number;
  itemName: string;
  itemImageUrl: string;
  rarity: "blue" | "purple" | "pink" | "red" | "gold" | "white";
  userName: string;
  openedAt: string;
};

const POLL_INTERVAL_MS = 5_000;

const transparentBoxCache = new Map<string, Promise<string>>();

function createTransparentBoxCutout(src: string) {
  const cached = transparentBoxCache.get(src);
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
      for (let index = 0; index < pixels.data.length; index += 4) {
        const brightest = Math.max(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]);
        if (brightest <= 4) pixels.data[index + 3] = 0;
        else if (brightest < 30) pixels.data[index + 3] = Math.round(pixels.data[index + 3] * Math.pow((brightest - 4) / 26, 0.72));
      }
      context.putImageData(pixels, 0, 0);
      canvas.toBlob((blob) => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("Cutout could not be created")), "image/png");
    };
    source.onerror = () => reject(new Error(`Could not load ${src}`));
    source.src = src;
  });
  transparentBoxCache.set(src, cutout);
  return cutout;
}

function useRecentDrops(boxId?: number, limit = 30) {
  const [drops, setDrops] = useState<RecentDrop[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (boxId != null) query.set("boxId", String(boxId));
    try {
      const response = await fetch(`/api/recent-drops?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("最近掉落读取失败");
      const payload = await response.json() as { drops?: RecentDrop[] };
      setDrops(payload.drops ?? []);
    } catch {
      // 保留上一轮数据，短暂的本地服务重载不会让滚动条闪空。
    } finally {
      setLoaded(true);
    }
  }, [boxId, limit]);

  useEffect(() => {
    let active = true;
    const update = () => { if (active) void refresh(); };
    update();
    const timer = window.setInterval(update, POLL_INTERVAL_MS);
    window.addEventListener("recent-drops:refresh", update);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("recent-drops:refresh", update);
    };
  }, [refresh]);

  return { drops, loaded };
}

function DropCard({ drop }: { drop: RecentDrop }) {
  const [transparentBoxSrc, setTransparentBoxSrc] = useState("");

  useEffect(() => {
    let active = true;
    createTransparentBoxCutout(drop.boxImageUrl)
      .then((src) => { if (active) setTransparentBoxSrc(src); })
      .catch(() => { if (active) setTransparentBoxSrc(""); });
    return () => { active = false; };
  }, [drop.boxImageUrl]);

  return (
    <a
      className={`drop-item rarity-${drop.rarity}`}
      href={`/classic-box/detail?box=${drop.boxId}`}
      aria-label={`${drop.userName} 在 ${drop.boxName} 开出 ${drop.itemName}`}
    >
      <span className="drop-art drop-item-art"><Image src={drop.itemImageUrl} alt={drop.itemName} width={190} height={98} /></span>
      <span className="drop-art drop-box-art">{transparentBoxSrc && <Image src={transparentBoxSrc} alt={drop.boxName} width={190} height={98} unoptimized />}</span>
      <span className="drop-caption drop-item-caption"><b>{drop.itemName}</b></span>
      <span className="drop-caption drop-box-caption"><b>{drop.boxName}</b><small>{drop.userName}</small></span>
    </a>
  );
}

export function RecentDropsStrip() {
  const { drops, loaded } = useRecentDrops(undefined, 30);
  const scrollingDrops = useMemo(() => {
    if (!drops.length) return [];
    const base = Array.from({ length: Math.max(8, drops.length) }, (_, index) => drops[index % drops.length]);
    return [...base, ...base];
  }, [drops]);

  return (
    <section className="recent-drops" aria-label="最近掉落" data-poll-interval={POLL_INTERVAL_MS}>
      {scrollingDrops.length > 0 ? (
        <div className="recent-drops-track">
          {scrollingDrops.map((drop, index) => <DropCard drop={drop} key={`${drop.id}-${index}`} />)}
        </div>
      ) : (
        <div className="drop-placeholder-wrap" aria-label={loaded ? "暂时还没有开箱记录" : "正在接入最近掉落数据"}>
          <div className="drop-placeholder-track" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <span className="drop-placeholder" key={index} />)}
          </div>
          <span className="drop-empty-label"><b>最近掉落</b><i />{loaded ? "等待首次开箱" : "等待接入数据"}</span>
        </div>
      )}
    </section>
  );
}

export function RecentBoxDrops({ boxId, boxName }: { boxId: number; boxName: string }) {
  const { drops, loaded } = useRecentDrops(boxId, 40);
  if (!drops.length) {
    return (
      <div className="detail-placeholder box-drops-empty" role="tabpanel">
        <b>{boxName} · 最近掉落</b>
        <span>{loaded ? "这个箱子还没有本地开箱记录。" : "正在读取最近掉落…"}</span>
      </div>
    );
  }
  return (
    <div className="box-drops-panel" role="tabpanel" aria-label={`${boxName}最近掉落`}>
      <div className="box-drops-head"><b>{boxName} · 最近掉落</b><span>每 5 秒自动更新</span></div>
      <div className="box-drops-grid">
        {drops.map((drop) => <DropCard drop={drop} key={drop.id} />)}
      </div>
    </div>
  );
}
