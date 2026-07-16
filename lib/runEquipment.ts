import {
  type CharacterStats,
  type Equipment,
  type EquipmentRarity,
  type EquipmentSlot,
  generateEquipment,
} from '@/lib/auth';

export const RUN_EQUIPMENT_SLOTS: EquipmentSlot[] = ['sword', 'shield', 'armor', 'armor-pants', 'boots', 'gloves', 'helmet'];

export const RUN_EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  sword: 'Sword',
  shield: 'Shield',
  armor: 'Chest',
  'armor-pants': 'Legs',
  boots: 'Boots',
  gloves: 'Gloves',
  helmet: 'Helm',
};

export const RUN_EQUIPMENT_LAYOUT: EquipmentSlot[][] = [
  ['sword', 'shield'],
  ['helmet', 'armor', 'armor-pants'],
  ['gloves', 'boots'],
];

export const RUN_MAX_EQUIPMENT_BAG = 14;

export interface RunEquipmentState {
  runEquipment: Equipment[];
  runEquippedSlots: Partial<Record<EquipmentSlot, string>>;
}

export function getRunEquipmentIconPath(item: Pick<Equipment, 'slot' | 'rarity'>): string {
  return `/assets/equipment/${item.slot}-${item.rarity}.png`;
}

export function getRunEquipmentStat(
  item: Equipment,
  stat: 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth',
): number {
  const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

  if (stat === 'armyPower') return finite(item.stats.armyPower ?? item.stats.attack);
  if (stat === 'defensivePower') return finite(item.stats.defensivePower ?? item.stats.defense);
  if (stat === 'morale') return finite(item.stats.morale ?? item.stats.speed);
  if (stat === 'spellPower') return finite(item.stats.spellPower);
  return finite(item.stats.maxHealth);
}

export function formatRunEquipmentSummary(item: Equipment): string {
  const parts = [
    getRunEquipmentStat(item, 'armyPower') ? `+${getRunEquipmentStat(item, 'armyPower')} ATK` : '',
    getRunEquipmentStat(item, 'defensivePower') ? `+${getRunEquipmentStat(item, 'defensivePower')} DEF` : '',
    getRunEquipmentStat(item, 'morale') ? `+${getRunEquipmentStat(item, 'morale')} SPD` : '',
    getRunEquipmentStat(item, 'spellPower') ? `+${getRunEquipmentStat(item, 'spellPower')} MAG` : '',
    getRunEquipmentStat(item, 'maxHealth') ? `+${getRunEquipmentStat(item, 'maxHealth')} HP` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'Commander gear';
}

export type RunEquipmentStatKey = 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth';

export const RUN_EQUIPMENT_STAT_LABELS: Record<RunEquipmentStatKey, string> = {
  armyPower: 'ATK',
  defensivePower: 'DEF',
  morale: 'SPD',
  spellPower: 'MAG',
  maxHealth: 'HP',
};

export const RUN_EQUIPMENT_STAT_KEYS: RunEquipmentStatKey[] = [
  'armyPower',
  'defensivePower',
  'morale',
  'spellPower',
  'maxHealth',
];

export interface RunEquipmentStatRow {
  key: RunEquipmentStatKey;
  label: string;
  value: number;
  equippedValue: number;
  delta: number;
}

export function getRunEquipmentStatRows(item: Equipment, compareEquipped?: Equipment): RunEquipmentStatRow[] {
  return RUN_EQUIPMENT_STAT_KEYS.map(key => {
    const value = getRunEquipmentStat(item, key);
    const equippedValue = compareEquipped ? getRunEquipmentStat(compareEquipped, key) : 0;
    return {
      key,
      label: RUN_EQUIPMENT_STAT_LABELS[key],
      value,
      equippedValue,
      delta: compareEquipped ? value - equippedValue : 0,
    };
  }).filter(row => row.value > 0 || row.equippedValue > 0);
}

export function formatEquipmentRarityLabel(rarity: EquipmentRarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

const RUN_EQUIPMENT_RARITY_RANK: Record<EquipmentRarity, number> = {
  decent: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

export function capRunEquipmentRarity(
  rarity: EquipmentRarity,
  maxRarity: EquipmentRarity = 'legendary',
): EquipmentRarity {
  return RUN_EQUIPMENT_RARITY_RANK[rarity] <= RUN_EQUIPMENT_RARITY_RANK[maxRarity]
    ? rarity
    : maxRarity;
}

export function rollRunEquipmentRarity(wins: number, targetBattles: number): EquipmentRarity {
  const progress = targetBattles > 0 ? Math.min(1, wins / targetBattles) : 0;
  const roll = Math.random();

  const legendaryChance = progress >= 0.78 ? 0.06 : progress >= 0.55 ? 0.025 : 0.01;
  const epicChance = progress >= 0.62 ? 0.12 : progress >= 0.38 ? 0.08 : 0.045;
  const rareChance = progress >= 0.48 ? 0.34 : progress >= 0.22 ? 0.26 : 0.18;

  if (roll < legendaryChance) return 'legendary';
  if (roll < legendaryChance + epicChance) return 'epic';
  if (roll < legendaryChance + epicChance + rareChance) return 'rare';
  return 'decent';
}

export function rollRunOfferEquipmentRarity(wins: number, targetBattles: number): EquipmentRarity {
  const progress = targetBattles > 0 ? Math.min(1, wins / targetBattles) : 0;
  const roll = Math.random();
  const legendaryChance = 0.02 + progress * 0.03;
  const epicChance = 0.08 + progress * 0.05;
  const rareChance = 0.28 + progress * 0.08;

  if (roll < legendaryChance) return 'legendary';
  if (roll < legendaryChance + epicChance) return 'epic';
  if (roll < legendaryChance + epicChance + rareChance) return 'rare';
  return 'decent';
}

export function generateRunLootEquipment(
  wins: number,
  targetBattles: number,
  forcedRarity?: EquipmentRarity,
  options?: { offer?: boolean; maxRarity?: EquipmentRarity },
): Equipment {
  const rolledRarity = forcedRarity || (
    options?.offer
      ? rollRunOfferEquipmentRarity(wins, targetBattles)
      : rollRunEquipmentRarity(wins, targetBattles)
  );
  const rarity = capRunEquipmentRarity(rolledRarity, options?.maxRarity);
  return generateEquipment(0, rarity) || generateEquipment(0, 'decent')!;
}

export function getEquippedRunItem(
  state: RunEquipmentState,
  slot: EquipmentSlot,
): Equipment | undefined {
  const equipmentId = state.runEquippedSlots[slot];
  if (!equipmentId) return undefined;
  return state.runEquipment.find(item => item.id === equipmentId);
}

export function getUnequippedRunEquipment(state: RunEquipmentState): Equipment[] {
  const equippedIds = new Set(Object.values(state.runEquippedSlots));
  return state.runEquipment.filter(item => !equippedIds.has(item.id));
}

function applyEquipmentStatDelta(stats: CharacterStats, item: Equipment, direction: 1 | -1): CharacterStats {
  const armyPower = getRunEquipmentStat(item, 'armyPower') * direction;
  const defensivePower = getRunEquipmentStat(item, 'defensivePower') * direction;
  const morale = getRunEquipmentStat(item, 'morale') * direction;
  const spellPower = getRunEquipmentStat(item, 'spellPower') * direction;
  const maxHealth = getRunEquipmentStat(item, 'maxHealth') * direction;
  const nextMaxHealth = stats.maxHealth + maxHealth;

  return {
    ...stats,
    armyPower: stats.armyPower + armyPower,
    defensivePower: stats.defensivePower + defensivePower,
    morale: stats.morale + morale,
    spellPower: stats.spellPower + spellPower,
    maxHealth: nextMaxHealth,
    health: Math.min(nextMaxHealth, Math.max(1, stats.health + maxHealth)),
  };
}

export function addRunEquipment<T extends RunEquipmentState & { stats: CharacterStats; notice?: string }>(
  session: T,
  item: Equipment,
): T {
  if (session.runEquipment.some(existing => existing.id === item.id)) {
    return { ...session, notice: `${item.name} is already in your run satchel.` };
  }

  if (session.runEquipment.length >= RUN_MAX_EQUIPMENT_BAG) {
    return { ...session, notice: 'Run satchel is full. Sell or equip gear before claiming more.' };
  }

  return {
    ...session,
    runEquipment: [...session.runEquipment, item],
    notice: `${item.name} added to run satchel.`,
  };
}

export function equipRunItem<T extends RunEquipmentState & { stats: CharacterStats; notice?: string }>(
  session: T,
  equipmentId: string,
): T {
  const item = session.runEquipment.find(entry => entry.id === equipmentId);
  if (!item) return { ...session, notice: 'That gear is not in your run satchel.' };

  const existingId = session.runEquippedSlots[item.slot];
  let nextSession: T = { ...session };
  if (existingId && existingId !== equipmentId) {
    nextSession = unequipRunItem(nextSession, item.slot);
  }

  const equippedSlots = { ...nextSession.runEquippedSlots, [item.slot]: equipmentId };
  return {
    ...nextSession,
    runEquippedSlots: equippedSlots,
    stats: applyEquipmentStatDelta(nextSession.stats, item, 1),
    notice: `${item.name} equipped.`,
  };
}

export function unequipRunItem<T extends RunEquipmentState & { stats: CharacterStats; notice?: string }>(
  session: T,
  slot: EquipmentSlot,
): T {
  const equipmentId = session.runEquippedSlots[slot];
  if (!equipmentId) return session;

  const item = session.runEquipment.find(entry => entry.id === equipmentId);
  if (!item) {
    const nextSlots = { ...session.runEquippedSlots };
    delete nextSlots[slot];
    return { ...session, runEquippedSlots: nextSlots };
  }

  const nextSlots = { ...session.runEquippedSlots };
  delete nextSlots[slot];

  return {
    ...session,
    runEquippedSlots: nextSlots,
    stats: applyEquipmentStatDelta(session.stats, item, -1),
    notice: `${item.name} unequipped.`,
  };
}

export function createEmptyRunEquipmentState(): RunEquipmentState {
  return {
    runEquipment: [],
    runEquippedSlots: {},
  };
}
