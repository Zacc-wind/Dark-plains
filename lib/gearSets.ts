import type { Equipment, EquipmentRarity, EquipmentSlot, User } from './auth';

export type GearSetId = 'guardian' | 'shadow-stalker' | 'arcane-weaver' | 'storm-caller';

export interface GearSetBonusTier {
  pieces: 2 | 4;
  stats: {
    armyPower?: number;
    defensivePower?: number;
    morale?: number;
    spellPower?: number;
    maxHealth?: number;
  };
  effect: string;
}

export interface GearSetDefinition {
  id: GearSetId;
  name: string;
  rarity: EquipmentRarity;
  slotNames: Partial<Record<EquipmentSlot, string>>;
  bonuses: GearSetBonusTier[];
  dropSources: Array<'boss' | 'dungeon' | 'elite' | 'mp-daily' | 'gem-vendor'>;
}

export const GEAR_SETS: GearSetDefinition[] = [
  {
    id: 'guardian',
    name: 'Guardian',
    rarity: 'epic',
    slotNames: {
      helmet: "Guardian's Visor",
      armor: "Guardian's Chestplate",
      shield: "Guardian's Aegis",
      gloves: "Guardian's Gauntlets",
      boots: "Guardian's Greaves",
      sword: "Guardian's Longsword",
      'armor-pants': "Guardian's Legguards",
    },
    bonuses: [
      { pieces: 2, stats: { defensivePower: 4, maxHealth: 25 }, effect: 'Bulwark: +8% damage reduction in combat.' },
      { pieces: 4, stats: { defensivePower: 8, maxHealth: 50 }, effect: 'Fortress: Revive one fallen unit once per battle at 35% HP.' },
    ],
    dropSources: ['boss', 'dungeon', 'mp-daily'],
  },
  {
    id: 'shadow-stalker',
    name: 'Shadow Stalker',
    rarity: 'epic',
    slotNames: {
      helmet: "Stalker's Hood",
      armor: "Stalker's Jerkin",
      gloves: "Stalker's Grips",
      boots: "Stalker's Treads",
      sword: "Stalker's Fang",
      'armor-pants': "Stalker's Breeches",
    },
    bonuses: [
      { pieces: 2, stats: { armyPower: 4, morale: 3 }, effect: 'Ambush: First strike deals +15% damage.' },
      { pieces: 4, stats: { armyPower: 7, morale: 5 }, effect: 'Nightstep: +10% crit chance on opening round.' },
    ],
    dropSources: ['elite', 'dungeon'],
  },
  {
    id: 'arcane-weaver',
    name: 'Arcane Weaver',
    rarity: 'legendary',
    slotNames: {
      helmet: "Weaver's Circlet",
      armor: "Weaver's Robes",
      gloves: "Weaver's Gloves",
      boots: "Weaver's Slippers",
      sword: "Weaver's Focus",
      shield: "Weaver's Ward",
      'armor-pants': "Weaver's Legwraps",
    },
    bonuses: [
      { pieces: 2, stats: { spellPower: 5, morale: 2 }, effect: 'Channel: Spells cost 1 less mana once per battle.' },
      { pieces: 4, stats: { spellPower: 9, maxHealth: 30 }, effect: 'Arcane Echo: Repeat your last spell at 50% power.' },
    ],
    dropSources: ['boss', 'gem-vendor'],
  },
  {
    id: 'storm-caller',
    name: 'Storm Caller',
    rarity: 'legendary',
    slotNames: {
      helmet: "Stormcaller's Crown",
      armor: "Stormcaller's Mantle",
      gloves: "Stormcaller's Bracers",
      boots: "Stormcaller's Striders",
      sword: "Stormcaller's Brand",
      shield: "Stormcaller's Barrier",
      'armor-pants': "Stormcaller's Kilt",
    },
    bonuses: [
      { pieces: 2, stats: { armyPower: 5, spellPower: 4 }, effect: 'Thunder: +12% army power after casting a spell.' },
      { pieces: 4, stats: { armyPower: 8, spellPower: 7, morale: 4 }, effect: 'Tempest: Chain lightning hits a second target for 40% damage.' },
    ],
    dropSources: ['boss', 'mp-daily', 'gem-vendor'],
  },
];

export function getGearSetById(setId: string): GearSetDefinition | undefined {
  return GEAR_SETS.find(set => set.id === setId);
}

export function getEquippedSetPieceCounts(user: Pick<User, 'equipment' | 'equippedSlots'>): Map<GearSetId, number> {
  const equippedIds = new Set(Object.values(user.equippedSlots || {}).filter(Boolean));
  const counts = new Map<GearSetId, number>();

  (user.equipment || []).forEach(item => {
    if (!item.gearSetId || !equippedIds.has(item.id)) return;
    const setId = item.gearSetId as GearSetId;
    counts.set(setId, (counts.get(setId) || 0) + 1);
  });

  return counts;
}

export interface ActiveGearSetSummary {
  setId: GearSetId;
  name: string;
  pieces: number;
  activeBonuses: GearSetBonusTier[];
}

export function getActiveGearSetSummaries(user: Pick<User, 'equipment' | 'equippedSlots'>): ActiveGearSetSummary[] {
  const counts = getEquippedSetPieceCounts(user);

  return GEAR_SETS.flatMap(set => {
    const pieces = counts.get(set.id) || 0;
    if (pieces < 2) return [];

    const activeBonuses = set.bonuses.filter(bonus => pieces >= bonus.pieces);
    return [{ setId: set.id, name: set.name, pieces, activeBonuses }];
  });
}

export function sumGearSetBonusStats(user: Pick<User, 'equipment' | 'equippedSlots'>): Required<GearSetBonusTier['stats']> {
  const totals = { armyPower: 0, defensivePower: 0, morale: 0, spellPower: 0, maxHealth: 0 };

  getActiveGearSetSummaries(user).forEach(summary => {
    summary.activeBonuses.forEach(bonus => {
      totals.armyPower += bonus.stats.armyPower || 0;
      totals.defensivePower += bonus.stats.defensivePower || 0;
      totals.morale += bonus.stats.morale || 0;
      totals.spellPower += bonus.stats.spellPower || 0;
      totals.maxHealth += bonus.stats.maxHealth || 0;
    });
  });

  return totals;
}

export function getGearSetPieceName(setId: GearSetId, slot: EquipmentSlot): string {
  const set = getGearSetById(setId);
  return set?.slotNames[slot] || `${set?.name || setId} ${slot}`;
}

export function rollGearSetForSource(source: GearSetDefinition['dropSources'][number]): GearSetId | null {
  const eligible = GEAR_SETS.filter(set => set.dropSources.includes(source));
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)]?.id || null;
}
