import type { Equipment, EquipmentRarity, EquipmentSlot } from './auth';
import { GEAR_SETS, getGearSetById, getGearSetPieceName, rollGearSetForSource, type GearSetId } from './gearSets';

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

function rollRarity(source: LootSource, dropBonus = 0): EquipmentRarity | null {
  const roll = Math.random() * 100 + dropBonus;

  if (source === 'gem-vendor') return roll < 70 ? 'epic' : 'legendary';
  if (source === 'dungeon-boss' || source === 'mp-daily') {
    if (roll < 8) return 'legendary';
    if (roll < 28) return 'epic';
    if (roll < 55) return 'rare';
    return 'decent';
  }
  if (source === 'dungeon' || source === 'elite') {
    if (roll < 3) return 'legendary';
    if (roll < 12) return 'epic';
    if (roll < 35) return 'rare';
    return roll < 60 ? 'decent' : null;
  }
  if (source === 'battle') {
    if (roll < 1.5) return 'legendary';
    if (roll < 6) return 'epic';
    if (roll < 18) return 'rare';
    return roll < 40 ? 'decent' : null;
  }

  return null;
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
  const rarity = context.forcedRarity || rollRarity(context.source, context.dropBonus || 0);
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
