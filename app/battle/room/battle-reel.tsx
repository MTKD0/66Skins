"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ClassicBox } from "../../classic-box/box-data";

const TARGET = 3;
const START = 31;
const DURATION = 4400;

/** Results are decided by the room. This reel only presents that result. */
export function BattleReel({ item, contents, side, round, onComplete, elapsedMs = 0 }: {
  item: ClassicBox; contents: ClassicBox[]; side: string; round: number;
  onComplete: (side: string, round: number) => void; elapsedMs?: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const callback = useRef(onComplete);
  const initialElapsed = useRef(elapsedMs);
  callback.current = onComplete;
  const [cards] = useState(() => Array.from({ length: START + 3 }, (_, index) =>
    index === TARGET ? item : contents[Math.floor(Math.random() * contents.length)]));
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;
    let previousEdge = START;
    const tick = new Audio("/assets/audio/roll-tick.mp3");
    tick.volume = 0.38;
    const animate = (time: number) => {
      if (!track.current || !viewport.current) return;
      if (start === null) start = time - initialElapsed.current;
      const progress = Math.min(1, Math.max(0, (time - start - 650) / DURATION));
      const eased = 1 - Math.pow(1 - progress, 4);
      // Decreasing card index means increasing Y: the strip travels DOWN.
      const position = START - (START - TARGET) * eased;
      track.current.style.transform = `translate3d(0, ${-position * viewport.current.clientHeight}px, 0)`;
      const edge = Math.floor(position + 0.5);
      if (edge !== previousEdge && progress < 1 && side === "left") {
        tick.currentTime = 0;
        void tick.play().catch(() => undefined);
      }
      previousEdge = edge;
      if (progress < 1) frame = requestAnimationFrame(animate);
      else {
        setSettled(true);
        callback.current(side, round);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); tick.pause(); };
  }, [round, side]);

  return <div className={`battle-reel ${settled ? "is-settled" : "is-rolling"}`} aria-label={settled ? `抽中 ${item.weaponName}` : "正在向下抽取饰品"}>
    <div className="battle-reel-window" ref={viewport}>
      <div className="battle-reel-track" ref={track}>
        {cards.map((card, index) => {
          const rank = contents.findIndex((entry) => entry.id === card.id) / contents.length;
          const tone = rank < 0.1 ? "gold" : rank < 0.5 ? "red" : "blue";
          return <div key={index} className={`battle-reel-card tone-${tone} ${settled && index === TARGET ? "is-winning" : ""}`}>
            <Image src={card.weaponSrc} alt={card.weaponName} width={360} height={210} loading="eager" />
          </div>;
        })}
      </div>
    </div>
    <div className="battle-reel-line" />
    <div className="battle-reel-caption" aria-live="polite">{settled ? <>{item.weaponName}<span>G {Number(item.itemValue).toFixed(2)}</span></> : "正在开箱…"}</div>
  </div>;
}
