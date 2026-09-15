export const CNY_PER_GAME_TOKEN = 6.5;

export function cnyToGameTokens(priceCny: number) {
  if (!Number.isFinite(priceCny) || priceCny < 0) return 0;
  return Math.round((priceCny / CNY_PER_GAME_TOKEN) * 100) / 100;
}

export function formatGameTokensFromCny(priceCny: number) {
  return cnyToGameTokens(priceCny).toFixed(2);
}
