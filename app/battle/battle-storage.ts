import type { Tier } from "../classic-box/box-data";

export const BATTLE_ROOM_KEY = "66skins:battle-room:v1";
export const BATTLE_HISTORY_KEY = "66skins:battle-history:v1";

export type BattleRoomConfig = {
  id: string;
  host: string;
  opponent: string;
  boxIds: number[];
  robot: boolean;
  totalCost: number;
  createdAt: string;
};

export type BattleHistoryItem = {
  id: string;
  host: string;
  opponent: string;
  rounds: number;
  entry: number;
  tier: Tier;
  boxIds: number[];
  result: string;
  playerTotal: number;
  opponentTotal: number;
  createdAt: string;
};

export function readBattleHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BATTLE_HISTORY_KEY) ?? "[]") as BattleHistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function saveBattleHistory(item: BattleHistoryItem) {
  const next = [item, ...readBattleHistory().filter((entry) => entry.id !== item.id)].slice(0, 30);
  window.localStorage.setItem(BATTLE_HISTORY_KEY, JSON.stringify(next));
}
