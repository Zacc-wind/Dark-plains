import type { MinionTier } from './auth';

export const MINION_TIER_MIN_LEVEL: Record<MinionTier, number> = {
  tier1: 1,
  tier2: 4,
  tier3: 7,
};

export function getMinionTierMinLevel(tier: MinionTier): number {
  return MINION_TIER_MIN_LEVEL[tier];
}

export function canAcquireMinionTier(tier: MinionTier, playerLevel: number): boolean {
  return Math.max(1, Math.floor(playerLevel || 1)) >= MINION_TIER_MIN_LEVEL[tier];
}
