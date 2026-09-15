"use client";

import { useEffect, useState } from "react";
import { boxAssets, type Tier } from "../classic-box/box-data";

const cache = new Map<Tier, Promise<string>>();

function createCutout(tier: Tier) {
  const cached = cache.get(tier);
  if (cached) return cached;
  const task = new Promise<string>((resolve, reject) => {
    const source = new window.Image();
    source.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return reject(new Error("Canvas unavailable"));
      context.drawImage(source, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const brightest = Math.max(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]);
        if (brightest <= 4) pixels.data[index + 3] = 0;
        else if (brightest < 30) pixels.data[index + 3] = Math.round(pixels.data[index + 3] * Math.pow((brightest - 4) / 26, .72));
      }
      context.putImageData(pixels, 0, 0);
      canvas.toBlob((blob) => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("Cutout failed")), "image/png");
    };
    source.onerror = () => reject(new Error("Box asset failed to load"));
    source.src = boxAssets[tier];
  });
  cache.set(tier, task);
  return task;
}

export function TransparentBattleBox({ tier, alt, className }: { tier: Tier; alt: string; className?: string }) {
  const [src, setSrc] = useState(boxAssets[tier]);
  useEffect(() => {
    let active = true;
    createCutout(tier).then((value) => { if (active) setSrc(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [tier]);
  return <img className={className} src={src} alt={alt} />;
}
