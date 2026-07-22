import type { Equipment, EquipmentRarity, EquipmentSlot } from './auth';
import { GEAR_SETS, getGearSetById, getGearSetPieceName, rollGearSetForSource, type GearSetId } from './gearSets';
import { capEquipmentRarityForLevel } from './gearProgression';

export type LootSource =
  | 'job'
  | 'battle'
  | 'dungeon'
  | 'dungeon-boss'
  | 'daily-run'
  | 'mp-daily'
  | 'elite'
  | 'gem-vendor'
  | 'quest';

export interface LootDropContext {
  source: LootSource;
  bossId?: string;
  dungeonId?: string;
  forcedRarity?: EquipmentRarity;
  dropBonus?: number;
  playerLevel?: number;
}

const BOSS_EXCLUSIVE_SETS: Record<string, GearSetId> = {
  'mirror-warden': 'arcane-weaver',
  'blackwater-revenant': 'shadow-stalker',
  'eclipse-hound': 'storm-caller',
};

const DUNGEON_EXCLUSIVE_SETS: Record<string, GearSetId> = {
  'crypt-of-echoes': 'shadow-stalker',
  'sunken-vault': 'guardian',
};

export function getLootEquipmentDropChance(source: LootSource, dropBonus = 0): number {
  const baseChance: Record<LootSource, number> = {
    job: 0,
    battle: 10,
    dungeon: 18,
    'dungeon-boss': 65,
    'daily-run': 16,
    'mp-daily': 70,
    elite: 25,
    'gem-vendor': 100,
    quest: 35,
  };
  return Math.min(100, baseChance[source] + Math.max(0, dropBonus) * 0.15);
}

export function rollLootEquipmentRarity(
  source: LootSource,
  playerLevel: number,
  dropBonus = 0,
  dropRoll = Math.random(),
  rarityRoll = Math.random(),
): EquipmentRarity | null {
  if (dropRoll * 100 >= getLootEquipmentDropChance(source, dropBonus)) return null;

  let requestedRarity: EquipmentRarity;
  if (source === 'gem-vendor') {
    requestedRarity = rarityRoll < 0.08 ? 'legendary' : 'epic';
  } else if (source === 'dungeon-boss' || source === 'mp-daily') {
    requestedRarity = rarityRoll < 0.025
      ? 'legendary'
      : rarityRoll < 0.16
        ? 'epic'
        : rarityRoll < 0.5
          ? 'rare'
          : 'decent';
  } else if (source === 'dungeon' || source === 'elite') {
    requestedRarity = rarityRoll < 0.006
      ? 'legendary'
      : rarityRoll < 0.055
        ? 'epic'
        : rarityRoll < 0.28
          ? 'rare'
          : 'decent';
  } else {
    requestedRarity = rarityRoll < 0.002
      ? 'legendary'
      : rarityRoll < 0.018
        ? 'epic'
        : rarityRoll < 0.13
          ? 'rare'
          : 'decent';
  }

  return capEquipmentRarityForLevel(requestedRarity, playerLevel);
}

function pickSetForContext(context: LootDropContext): GearSetId | null {
  if (context.bossId && BOSS_EXCLUSIVE_SETS[context.bossId]) {
    return Math.random() < 0.35 ? BOSS_EXCLUSIVE_SETS[context.bossId] : rollGearSetForSource('boss');
  }
  if (context.dungeonId && DUNGEON_EXCLUSIVE_SETS[context.dungeonId]) {
    return Math.random() < 0.30 ? DUNGEON_EXCLUSIVE_SETS[context.dungeonId] : rollGearSetForSource('dungeon');
  }

  if (context.source === 'mp-daily') return rollGearSetForSource('mp-daily');
  if (context.source === 'dungeon-boss') return rollGearSetForSource('boss');
  if (context.source === 'dungeon') return rollGearSetForSource('dungeon');
  if (context.source === 'elite') return rollGearSetForSource('elite');
  if (context.source === 'gem-vendor') return rollGearSetForSource('gem-vendor');

  return Math.random() < 0.08 ? rollGearSetForSource('boss') : null;
}

function buildSetPieceStats(rarity: EquipmentRarity, slot: EquipmentSlot): Equipment['stats'] {
  const ranges = {
    decent: { min: 1, max: 3 },
    rare: { min: 3, max: 6 },
    epic: { min: 6, max: 10 },
    legendary: { min: 10, max: 15 },
  } as const;
  const range = ranges[rarity];
  const roll = () => Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

  if (slot === 'sword') return { armyPower: roll() };
  if (slot === 'shield') return { defensivePower: roll() };
  if (slot === 'armor') return { defensivePower: roll(), maxHealth: roll() * 5 };
  if (slot === 'armor-pants') return { defensivePower: roll() };
  if (slot === 'boots') return { morale: roll() };
  if (slot === 'gloves') return { armyPower: roll() };
  return { spellPower: roll() };
}

export function generateLootEquipment(context: LootDropContext): Equipment | null {
  const playerLevel = Math.max(1, Math.floor(context.playerLevel || 30));
  const rarity = context.forcedRarity
    ? capEquipmentRarityForLevel(context.forcedRarity, playerLevel)
    : rollLootEquipmentRarity(context.source, playerLevel, context.dropBonus || 0);
  if (!rarity) return null;

  const slots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'armor-pants', 'boots', 'gloves', 'helmet'];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const setId = (rarity === 'epic' || rarity === 'legendary') ? pickSetForContext(context) : null;
  const setDef = setId ? getGearSetById(setId) : undefined;
  const useSetName = Boolean(setDef && setDef.rarity === rarity);

  const item: Equipment = {
    id: `loot-${slot}-${rarity}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: useSetName && setId ? getGearSetPieceName(setId, slot) : `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)} ${slot.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')}`,
    slot,
    rarity,
    stats: buildSetPieceStats(rarity, slot),
    socketBonuses: [],
    gearSetId: useSetName ? setId || undefined : undefined,
    lootSource: context.source,
  };

  if (rarity === 'legendary' && !item.gearSetId) {
    const passives = [
      'Swift: Travel time reduced by another 25%',
      'Lucky: +10% equipment drop chance from jobs',
      'Wealthy: +50% gold from jobs',
    ];
    item.passive = passives[Math.floor(Math.random() * passives.length)];
  }

  return item;
}

export function getGearSetCatalog(): typeof GEAR_SETS {
  return GEAR_SETS;
}
