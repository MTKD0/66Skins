/** Future server-authoritative transport; no fake remote players or local payouts. */
export type BattlePlayer = { id: string; name: string; avatarUrl: string };
export type BattleDrop = { round: number; playerId: string; itemId: string; name: string; imageUrl: string; priceTokens: number };
export type BattleSnapshot = {
  id: string;
  revision: number;
  status: "waiting" | "countdown" | "playing" | "finished" | "cancelled";
  players: BattlePlayer[];
  boxIds: number[];
  round: number;
  roundStartedAt: string | null;
  drops: BattleDrop[];
  winnerId: string | null;
};
export interface BattleTransport {
  listRooms(signal?: AbortSignal): Promise<BattleSnapshot[]>;
  createRoom(boxIds: number[], requestId: string): Promise<BattleSnapshot>;
  joinRoom(roomId: string, requestId: string): Promise<BattleSnapshot>;
  getRoom(roomId: string, signal?: AbortSignal): Promise<BattleSnapshot>;
  cancelRoom(roomId: string, requestId: string): Promise<BattleSnapshot>;
}
