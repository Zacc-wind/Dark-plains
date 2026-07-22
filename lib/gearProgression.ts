import type { EquipmentRarity } from './auth';

export const EQUIPMENT_RARITY_MIN_LEVEL: Record<EquipmentRarity, number> = {
  decent: 3,
  rare: 5,
  epic: 10,
  legendary: 15,
};

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
