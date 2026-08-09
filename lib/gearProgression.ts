import type { Equipment, EquipmentRarity, EquipmentSlot } from './auth';

export const EQUIPMENT_RARITY_MIN_LEVEL: Record<EquipmentRarity, number> = {
  decent: 3,
  rare: 5,
  epic: 10,
  legendary: 15,
};

export type EquipmentQualityLabel = 'Fine' | 'Lucky+';

export const EQUIPMENT_LUCKY_DROP_CHANCE = 0.02;
export const EQUIPMENT_ROLL_MIN = 0.85;
export const EQUIPMENT_ROLL_MAX = 1.15;
export const EQUIPMENT_LUCKY_ROLL_MIN = 1;
export const EQUIPMENT_FINE_QUALITY_THRESHOLD = 1.05;

export const EQUIPMENT_STAT_RANGES: Record<EquipmentRarity, { min: number; max: number }> = {
  decent: { min: 1, max: 3 },
  rare: { min: 3, max: 6 },
  epic: { min: 6, max: 10 },
  legendary: { min: 10, max: 15 },
};

export interface EquipmentRollAffix {
  isLucky: boolean;
  rollMultiplier: number;
  qualityLabel?: EquipmentQualityLabel;
}

export function rollEquipmentAffix(
  luckyRoll = Math.random(),
  qualityRoll = Math.random(),
): EquipmentRollAffix {
  const isLucky = luckyRoll < EQUIPMENT_LUCKY_DROP_CHANCE;
  const min = isLucky ? EQUIPMENT_LUCKY_ROLL_MIN : EQUIPMENT_ROLL_MIN;
  const rollMultiplier = Math.round((min + qualityRoll * (EQUIPMENT_ROLL_MAX - min)) * 100) / 100;

  if (isLucky) {
    return { isLucky: true, rollMultiplier, qualityLabel: 'Lucky+' };
  }
  if (rollMultiplier >= EQUIPMENT_FINE_QUALITY_THRESHOLD) {
    return { isLucky: false, rollMultiplier, qualityLabel: 'Fine' };
  }
  return { isLucky: false, rollMultiplier };
}

export function scaleEquipmentStat(base: number, rollMultiplier: number, minValue = 1): number {
  return Math.max(minValue, Math.round(base * rollMultiplier));
}

export function rollEquipmentBaseStat(rarity: EquipmentRarity, rng = Math.random): number {
  const range = EQUIPMENT_STAT_RANGES[rarity];
  return Math.floor(rng() * (range.max - range.min + 1)) + range.min;
}

export function buildRolledEquipmentStats(
  rarity: EquipmentRarity,
  slot: EquipmentSlot,
  rollMultiplier: number,
  rng = Math.random,
): Equipment['stats'] {
  const roll = () => scaleEquipmentStat(rollEquipmentBaseStat(rarity, rng), rollMultiplier);

  if (slot === 'sword') return { armyPower: roll() };
  if (slot === 'shield') return { defensivePower: roll() };
  if (slot === 'armor') {
    return {
      defensivePower: roll(),
      maxHealth: scaleEquipmentStat(rollEquipmentBaseStat(rarity, rng) * 5, rollMultiplier, 5),
    };
  }
  if (slot === 'armor-pants') return { defensivePower: roll() };
  if (slot === 'boots') return { morale: roll() };
  if (slot === 'gloves') return { armyPower: roll() };
  return { spellPower: roll() };
}

export function applyLuckyNameSuffix(name: string, isLucky: boolean): string {
  if (!isLucky) return name;
  return name.endsWith('+') ? name : `${name}+`;
}

export function formatEquipmentQualityLabel(
  item: Pick<Equipment, 'isLucky' | 'qualityLabel' | 'rollMultiplier'>,
): EquipmentQualityLabel | undefined {
  if (item.qualityLabel === 'Lucky+' || item.qualityLabel === 'Fine') return item.qualityLabel;
  if (item.isLucky) return 'Lucky+';
  if (typeof item.rollMultiplier === 'number' && item.rollMultiplier >= EQUIPMENT_FINE_QUALITY_THRESHOLD) {
    return 'Fine';
  }
  return undefined;
}

export const RANDOM_JOB_GEAR_MIN_LEVEL = 3;

const EQUIPMENT_RARITY_ORDER: EquipmentRarity[] = ['decent', 'rare', 'epic', 'legendary'];

export function getEquipmentRarityMinLevel(rarity: EquipmentRarity): number {
  return EQUIPMENT_RARITY_MIN_LEVEL[rarity];
}

export function isEquipmentRarityUnlocked(rarity: EquipmentRarity, playerLevel: number): boolean {
  return Math.max(1, Math.floor(playerLevel || 1)) >= EQUIPMENT_RARITY_MIN_LEVEL[rarity];
}

export function capEquipmentRarityForLevel(
  rarity: EquipmentRarity,
  playerLevel: number,
): EquipmentRarity | null {
  const requestedIndex = EQUIPMENT_RARITY_ORDER.indexOf(rarity);
  for (let index = requestedIndex; index >= 0; index -= 1) {
    const candidate = EQUIPMENT_RARITY_ORDER[index];
    if (isEquipmentRarityUnlocked(candidate, playerLevel)) return candidate;
  }
  return null;
}

export function getJobEquipmentDropChance(
  workDuration: number,
  playerLevel: number,
  dropBonus = 0,
): number {
  if (playerLevel < RANDOM_JOB_GEAR_MIN_LEVEL) return 0;

  const baseChance = workDuration >= 60 * 60 * 1000
    ? 14
    : workDuration >= 30 * 60 * 1000
      ? 8
      : workDuration >= 10 * 60 * 1000
        ? 4
        : 1.5;
  return Math.min(18, baseChance + Math.max(0, dropBonus) * 0.15);
}

export function getHighestJobEquipmentRarity(
  workDuration: number,
  playerLevel: number,
): EquipmentRarity | null {
  const durationCap: EquipmentRarity = workDuration >= 60 * 60 * 1000
    ? 'legendary'
    : workDuration >= 30 * 60 * 1000
      ? 'epic'
      : workDuration >= 10 * 60 * 1000
        ? 'rare'
        : 'decent';
  return capEquipmentRarityForLevel(durationCap, playerLevel);
}

export function rollJobEquipmentRarity(
  workDuration: number,
  playerLevel: number,
  dropBonus = 0,
  dropRoll = Math.random(),
  rarityRoll = Math.random(),
): EquipmentRarity | null {
  const dropChance = getJobEquipmentDropChance(workDuration, playerLevel, dropBonus);
  if (dropRoll * 100 >= dropChance) return null;

  const rarityCap = getHighestJobEquipmentRarity(workDuration, playerLevel);
  if (!rarityCap) return null;
  const rarityCapIndex = EQUIPMENT_RARITY_ORDER.indexOf(rarityCap);

  const legendaryChance = rarityCapIndex >= 3 ? 0.005 : 0;
  const epicChance = rarityCapIndex >= 2 ? (workDuration >= 60 * 60 * 1000 ? 0.045 : 0.02) : 0;
  const rareChance = rarityCapIndex >= 1 ? (workDuration >= 60 * 60 * 1000 ? 0.22 : workDuration >= 30 * 60 * 1000 ? 0.16 : 0.1) : 0;

  if (rarityRoll < legendaryChance) return 'legendary';
  if (rarityRoll < legendaryChance + epicChance) return 'epic';
  if (rarityRoll < legendaryChance + epicChance + rareChance) return 'rare';
  return 'decent';
}
