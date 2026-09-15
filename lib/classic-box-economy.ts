const GOLD_POOL_PROBABILITY = 0.05;
const RED_POOL_PROBABILITY = 0.30;
const BLUE_POOL_PROBABILITY = 0.65;
const TARGET_PAYOUT_RATE = 0.92;

export function getClassicBoxProbability(index: number, total: number) {
  if (total <= 0) return 0;
  const goldCount = Math.max(1, Math.round(total * 0.1));
  const redCount = Math.max(1, Math.round(total * 0.4));
  const blueCount = Math.max(1, total - goldCount - redCount);
  if (index < goldCount) return GOLD_POOL_PROBABILITY / goldCount;
  if (index < goldCount + redCount) return RED_POOL_PROBABILITY / redCount;
  return BLUE_POOL_PROBABILITY / blueCount;
}

export function calculateBalancedBoxPrice(itemValues: number[]) {
  const sorted = itemValues.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => b - a);
  if (!sorted.length) return 0.05;
  const expectedReward = sorted.reduce((sum, value, index) => sum + value * getClassicBoxProbability(index, sorted.length), 0);
  return Math.max(0.05, Math.round((expectedReward / TARGET_PAYOUT_RATE) * 100) / 100);
}

export function pickClassicBoxIndex(total: number, random = Math.random()) {
  let cursor = 0;
  for (let index = 0; index < total; index += 1) {
    cursor += getClassicBoxProbability(index, total);
    if (random <= cursor || index === total - 1) return index;
  }
  return Math.max(0, total - 1);
}

export const classicBoxProbabilityLegend = {
  gold: GOLD_POOL_PROBABILITY,
  red: RED_POOL_PROBABILITY,
  blue: BLUE_POOL_PROBABILITY,
  payoutRate: TARGET_PAYOUT_RATE,
};
