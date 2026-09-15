"use client";

import { useEffect, useRef, useState } from "react";
import "./shared-header.css";

type GameCenterMenuProps = {
  active?: "classic" | "battle" | "lucky";
  buttonClassName?: string;
  onUnavailable: (message: string) => void;
};

export function GameCenterMenu({ active, buttonClassName = "", onUnavailable }: GameCenterMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const navigate = (path: string) => {
    setOpen(false);
    window.location.assign(path);
  };

  return (
    <div className={`shared-game-menu${open ? " is-open" : ""}`} ref={menuRef}>
      <button className={buttonClassName} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="shared-game-icon">▦</span>游戏中心<span className="shared-game-chevron">⌄</span>
      </button>
      <div className="shared-game-dropdown" role="menu" aria-label="游戏中心">
        <button className={active === "classic" ? "active" : ""} type="button" role="menuitem" onClick={() => navigate("/classic-box")}><i>▣</i><span>经典盲盒</span></button>
        <button className={active === "battle" ? "active" : ""} type="button" role="menuitem" onClick={() => navigate("/battle")}><i>⚔</i><span>对战PK</span></button>
        <button className={active === "lucky" ? "active" : ""} type="button" role="menuitem" onClick={() => navigate("/lucky")}><i>♣</i><span>幸运饰品</span></button>
        <button type="button" role="menuitem" onClick={() => { setOpen(false); onUnavailable("ROLL房玩法将在下一阶段恢复"); }}><i>⌂</i><span>ROLL房</span></button>
      </div>
    </div>
  );
}
