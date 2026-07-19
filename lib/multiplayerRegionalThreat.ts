export interface RegionalThreatDefinition {
  id: string;
  title: string;
  faction: string;
  regionId: string;
  regionName: string;
  description: string;
  bossId: string;
  bossName: string;
  featuredMinionTemplateIds: string[];
  minLevel: number;
  targetPatrolWins: number;
  rewardGold: number;
  rewardExp: number;
  rewardRareGems: number;
}

export interface RegionalThreatEvent {
  kind?: string;
  contextId?: string;
  targetId?: string;
  occurredAt?: number;
}

export interface RegionalThreatView extends RegionalThreatDefinition {
  instanceId: string;
  weekKey: string;
  expiresAt: number;
  patrolProgress: number;
  bossDefeated: boolean;
  complete: boolean;
  claimed: boolean;
  unlocked: boolean;
}

export const REGIONAL_THREAT_DEFINITIONS: RegionalThreatDefinition[] = [
  {
    id: 'black-pike-resurgence',
    title: 'The Black Pike Resurgence',
    faction: 'Candle Compact',
    regionId: 'western-vigil',
    regionName: 'Western Vigil',
    description: 'Black Pike survivors are drilling fresh toll companies around the western road under a stolen blue oath.',
    bossId: 'ser-kael-duskplate',
    bossName: 'Ser Kael Duskplate',
    featuredMinionTemplateIds: ['crossbow', 'bell'],
    minLevel: 6,
    targetPatrolWins: 3,
    rewardGold: 260,
    rewardExp: 120,
    rewardRareGems: 1,
  },
  {
    id: 'cinder-procession',
    title: 'The Cinder Procession',
    faction: 'Candle Compact',
    regionId: 'moonfen-crossroads',
    regionName: 'Moonfen Crossroads',
    description: 'Candle-fire pilgrims are replacing road lamps with black saint flames and feeding the smoke with field reports.',
    bossId: 'mother-cindervein',
    bossName: 'Mother Cindervein',
    featuredMinionTemplateIds: ['darkpriest', 'witchdoc'],
    minLevel: 6,
    targetPatrolWins: 3,
    rewardGold: 280,
    rewardExp: 130,
    rewardRareGems: 1,
  },
  {
    id: 'blackroot-march',
    title: 'The Blackroot March',
    faction: 'Ashen Orders',
    regionId: 'western-vigil',
    regionName: 'Western Vigil',
    description: 'Buried roots are lifting old warbands from the vigil fields and marching them toward the occupied road shrines.',
    bossId: 'blackroot-vessel',
    bossName: 'Blackroot Vessel',
    featuredMinionTemplateIds: ['fallen', 'plaugedoc'],
    minLevel: 6,
    targetPatrolWins: 3,
    rewardGold: 300,
    rewardExp: 140,
    rewardRareGems: 1,
  },
];

function hashText(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getWeekEnd(weekKey: string): number {
  const [year, month, day] = weekKey.split('-').map(Number);
  const start = new Date(year, Math.max(0, month - 1), day);
  start.setDate(start.getDate() + 7);
  return start.getTime();
}

export function getRegionalThreatDefinition(weekKey: string): RegionalThreatDefinition {
  return REGIONAL_THREAT_DEFINITIONS[hashText(weekKey) % REGIONAL_THREAT_DEFINITIONS.length];
}

export function getRegionalThreatView({
  weekKey,
  level,
  events,
  claimedIds,
}: {
  weekKey: string;
  level: number;
  events: readonly RegionalThreatEvent[];
  claimedIds: readonly string[];
}): RegionalThreatView {
  const definition = getRegionalThreatDefinition(weekKey);
  const instanceId = `${weekKey}:${definition.id}`;
  const [year, month, day] = weekKey.split('-').map(Number);
  const weekStart = new Date(year, Math.max(0, month - 1), day).getTime();
  const matchingEvents = events.filter(event => (
    (event.occurredAt || 0) >= weekStart && event.contextId === definition.regionId
  ));
  const bossEnemyId = `regional-threat-boss-${weekKey}-${definition.id}`;
  const patrolProgress = matchingEvents.filter(event => (
    event.kind === 'battle-result-claimed' && event.targetId !== bossEnemyId
  )).length;
  const bossDefeated = matchingEvents.some(event => (
    event.kind === 'boss-defeated' && event.targetId === definition.bossId
  ));
  const unlocked = Math.max(1, Math.floor(level || 1)) >= definition.minLevel;

  return {
    ...definition,
    instanceId,
    weekKey,
    expiresAt: getWeekEnd(weekKey),
    patrolProgress: Math.min(definition.targetPatrolWins, patrolProgress),
    bossDefeated,
    complete: unlocked && patrolProgress >= definition.targetPatrolWins && bossDefeated,
    claimed: claimedIds.includes(instanceId),
    unlocked,
  };
}

export function getRegionalThreatBossEnemyId(weekKey: string): string {
  return `regional-threat-boss-${weekKey}-${getRegionalThreatDefinition(weekKey).id}`;
}
