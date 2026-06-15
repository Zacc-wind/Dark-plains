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
  if (stat === 'armyPower') return item.stats.armyPower ?? item.stats.attack ?? 0;
  if (stat === 'defensivePower') return item.stats.defensivePower ?? item.stats.defense ?? 0;
  if (stat === 'morale') return item.stats.morale ?? item.stats.speed ?? 0;
  if (stat === 'spellPower') return item.stats.spellPower ?? 0;
  return item.stats.maxHealth ?? 0;
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

export function rollRunEquipmentRarity(wins: number, targetBattles: number): EquipmentRarity {
  const progress = targetBattles > 0 ? Math.min(1, wins / targetBattles) : 0;
  const roll = Math.random();

  const legendaryChance = progress >= 0.78 ? 0.04 : progress >= 0.55 ? 0.015 : 0;
  const epicChance = progress >= 0.62 ? 0.09 : progress >= 0.38 ? 0.055 : 0.028;
  const rareChance = progress >= 0.48 ? 0.3 : progress >= 0.22 ? 0.22 : 0.13;

  if (roll < legendaryChance) return 'legendary';
  if (roll < legendaryChance + epicChance) return 'epic';
  if (roll < legendaryChance + epicChance + rareChance) return 'rare';
  return 'decent';
}

export function generateRunLootEquipment(
  wins: number,
  targetBattles: number,
  forcedRarity?: EquipmentRarity,
): Equipment {
  const rarity = forcedRarity || rollRunEquipmentRarity(wins, targetBattles);
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
