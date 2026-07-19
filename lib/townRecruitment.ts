export type TownRecruitmentTown =
  | 'Harborview'
  | 'Riverside'
  | 'Blackwater Gate'
  | 'Moonbridge'
  | 'Ashford'
  | 'Eclipse Hold';

export type TownRecruitmentTier = 'tier1' | 'tier2';

export const TOWN_RECRUITMENT_TOWNS: readonly TownRecruitmentTown[] = [
  'Harborview',
  'Riverside',
  'Blackwater Gate',
  'Moonbridge',
  'Ashford',
  'Eclipse Hold',
] as const;

export interface TownRecruitmentClaim {
  offerId: string;
  weekKey: string;
  townName: TownRecruitmentTown;
  templateId: string;
  claimedAt: number;
}

export interface TownRecruitmentSlot {
  offerId: string;
  weekKey: string;
  townName: TownRecruitmentTown;
  tier: TownRecruitmentTier;
  templateId: string;
  price: number;
  minLevel: number;
  unlocked: boolean;
  claimed: boolean;
  resetsAt: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const TIER_ONE_POOLS: Record<TownRecruitmentTown, readonly string[]> = {
  Harborview: ['knight-squire', 'templar-initiate', 'crossbow'],
  Riverside: ['priest-acolyte', 'wizard-apprentice', 'witchdoc'],
  'Blackwater Gate': ['crossbow', 'witchdoc', 'knight-squire'],
  Moonbridge: ['wizard-apprentice', 'priest-acolyte', 'templar-initiate'],
  Ashford: ['knight-squire', 'crossbow', 'templar-initiate'],
  'Eclipse Hold': ['witchdoc', 'crossbow', 'wizard-apprentice'],
};

const TIER_TWO_POOLS: Partial<Record<TownRecruitmentTown, readonly string[]>> = {
  Harborview: ['knight-man-at-arms', 'templar-crusader', 'firelord'],
  Riverside: ['priest-cleric', 'wizard-magus', 'enchanter'],
};

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getWeekStart(now: number): number {
  const date = new Date(Number.isFinite(now) ? now : Date.now());
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

export function getTownRecruitmentWeekKey(now = Date.now()): string {
  return new Date(getWeekStart(now)).toISOString().slice(0, 10);
}

export function normalizeTownRecruitmentClaims(
  claims: readonly TownRecruitmentClaim[] | null | undefined,
): TownRecruitmentClaim[] {
  const seen = new Set<string>();
  return (claims || [])
    .filter(claim => (
      Boolean(claim?.offerId)
      && Boolean(claim?.weekKey)
      && Boolean(claim?.townName)
      && Boolean(claim?.templateId)
      && Number.isFinite(claim?.claimedAt)
    ))
    .sort((left, right) => right.claimedAt - left.claimedAt)
    .filter(claim => {
      if (seen.has(claim.offerId)) return false;
      seen.add(claim.offerId);
      return true;
    })
    .slice(0, 128)
    .map(claim => ({ ...claim, claimedAt: Math.max(1, Math.floor(claim.claimedAt)) }));
}

function buildSlot(
  townName: TownRecruitmentTown,
  tier: TownRecruitmentTier,
  pool: readonly string[],
  playerLevel: number,
  claims: readonly TownRecruitmentClaim[],
  now: number,
): TownRecruitmentSlot {
  const weekStart = getWeekStart(now);
  const weekKey = getTownRecruitmentWeekKey(now);
  const seed = hashText(`${weekKey}:${townName}:${tier}`);
  const templateId = pool[seed % pool.length];
  const minLevel = tier === 'tier2' ? 5 : 1;
  const price = tier === 'tier2' ? 800 + (seed % 151) : 220 + (seed % 81);
  const offerId = `${weekKey}:${townName.toLowerCase().replace(/\s+/g, '-')}:${tier}`;

  return {
    offerId,
    weekKey,
    townName,
    tier,
    templateId,
    price,
    minLevel,
    unlocked: Math.max(1, Math.floor(playerLevel || 1)) >= minLevel,
    claimed: claims.some(claim => claim.offerId === offerId),
    resetsAt: weekStart + WEEK_MS,
  };
}

export function getTownRecruitmentSlots(
  townName: TownRecruitmentTown,
  playerLevel: number,
  claims: readonly TownRecruitmentClaim[] | null | undefined,
  now = Date.now(),
): TownRecruitmentSlot[] {
  const normalizedClaims = normalizeTownRecruitmentClaims(claims);
  const slots = [buildSlot(
    townName,
    'tier1',
    TIER_ONE_POOLS[townName],
    playerLevel,
    normalizedClaims,
    now,
  )];
  const specialistPool = TIER_TWO_POOLS[townName];
  if (specialistPool) {
    slots.push(buildSlot(townName, 'tier2', specialistPool, playerLevel, normalizedClaims, now));
  }
  return slots;
}
