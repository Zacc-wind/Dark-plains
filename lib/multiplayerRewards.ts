export type MultiplayerRewardSource = 'job' | 'contract' | 'campaign' | 'pve' | 'pvp' | 'coop';

export interface MultiplayerRewardValues {
  gold: number;
  exp: number;
}

export interface MultiplayerRewardBand {
  id: string;
  minLevel: number;
  maxLevel: number;
  goldMultiplier: number;
  expMultiplier: number;
}

export const MULTIPLAYER_REWARD_BANDS: readonly MultiplayerRewardBand[] = [
  { id: 'onboarding', minLevel: 1, maxLevel: 5, goldMultiplier: 1, expMultiplier: 1 },
  { id: 'regional', minLevel: 6, maxLevel: 10, goldMultiplier: 1.2, expMultiplier: 1.25 },
  { id: 'seasoned', minLevel: 11, maxLevel: 15, goldMultiplier: 1.45, expMultiplier: 1.55 },
  { id: 'veteran', minLevel: 16, maxLevel: 20, goldMultiplier: 1.75, expMultiplier: 1.9 },
  { id: 'elite', minLevel: 21, maxLevel: 25, goldMultiplier: 2.1, expMultiplier: 2.3 },
  { id: 'command', minLevel: 26, maxLevel: 30, goldMultiplier: 2.5, expMultiplier: 2.75 },
] as const;

const SOURCE_GROWTH: Record<MultiplayerRewardSource, number> = {
  job: 1.15,
  contract: 1,
  campaign: 0.9,
  pve: 0.9,
  pvp: 0.85,
  coop: 0.75,
};

function normalizeLevel(level: number): number {
  return Math.max(1, Math.min(30, Math.floor(Number.isFinite(level) ? level : 1)));
}

export function getMultiplayerRewardBand(level: number): MultiplayerRewardBand {
  const normalizedLevel = normalizeLevel(level);
  return MULTIPLAYER_REWARD_BANDS.find(band => normalizedLevel <= band.maxLevel)
    || MULTIPLAYER_REWARD_BANDS[MULTIPLAYER_REWARD_BANDS.length - 1];
}

function getSourceMultiplier(baseMultiplier: number, source: MultiplayerRewardSource): number {
  return 1 + (baseMultiplier - 1) * SOURCE_GROWTH[source];
}

function scaleValue(value: number, multiplier: number): number {
  const normalizedValue = Math.max(0, Number.isFinite(value) ? value : 0);
  if (normalizedValue <= 0) return 0;
  return Math.max(1, Math.round(normalizedValue * multiplier));
}

export function scaleMultiplayerRewards(
  rewards: MultiplayerRewardValues,
  level: number,
  source: MultiplayerRewardSource,
): MultiplayerRewardValues {
  const band = getMultiplayerRewardBand(level);
  return {
    gold: scaleValue(rewards.gold, getSourceMultiplier(band.goldMultiplier, source)),
    exp: scaleValue(rewards.exp, getSourceMultiplier(band.expMultiplier, source)),
  };
}

export function capCampaignRewardExp(
  exp: number,
  levelRequirement: number,
  capRatio = 0.8,
): number {
  const safeRequirement = Math.max(1, Math.floor(Number.isFinite(levelRequirement) ? levelRequirement : 1));
  const safeRatio = Math.max(0, Math.min(1, Number.isFinite(capRatio) ? capRatio : 0.8));
  return Math.min(Math.max(0, Math.round(exp)), Math.floor(safeRequirement * safeRatio));
}
