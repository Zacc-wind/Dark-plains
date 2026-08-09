export interface MoonwellSideBossDefinition {
  id: 'moonfen-brood' | 'tollroad-hexer';
  enemyId: string;
  bossId: string;
  level: number;
  minSpawnLevel: number;
  unlockAfterQuestId: string;
  completionQuestId: string;
  regionId: string;
  storyLabel: string;
  lootMultiplier: number;
  poiName: string;
}

export interface MoonwellSideSubject {
  stats?: { level?: number } | null;
  storyQuests?: Array<{
    questId: string;
    claimed?: boolean;
  }> | null;
  activityLog?: Array<{
    id?: string;
    type?: string;
    title?: string;
    source?: string;
    description?: string;
  }> | null;
}

export const MOONWELL_SIDE_BOSSES: MoonwellSideBossDefinition[] = [
  {
    id: 'moonfen-brood',
    enemyId: 'story-elite-moonfen-brood',
    bossId: 'moonfen-brood-mother',
    level: 8,
    minSpawnLevel: 7,
    unlockAfterQuestId: 'story-07-moonwell',
    completionQuestId: 'story-side-silk-clear',
    regionId: 'moonwell-silk-nest',
    storyLabel: 'Moonwell Side: Silk Nest',
    lootMultiplier: 1.6,
    poiName: 'Moonbridge',
  },
  {
    id: 'tollroad-hexer',
    enemyId: 'story-elite-tollroad-hexer',
    bossId: 'tollroad-goblin-hexer',
    level: 8,
    minSpawnLevel: 7,
    unlockAfterQuestId: 'story-side-tithe-cutters',
    completionQuestId: 'story-side-tithe-ledger',
    regionId: 'moonwell-tithe-cutters',
    storyLabel: 'Moonwell Side: Stolen Tithe',
    lootMultiplier: 1.6,
    poiName: 'Crossroads Camp',
  },
];

function hasClaimedStoryQuest(subject: MoonwellSideSubject, questId: string): boolean {
  return Boolean(subject.storyQuests?.some(progress => progress.questId === questId && progress.claimed));
}

export function hasDefeatedMoonwellSideBoss(
  subject: MoonwellSideSubject | null | undefined,
  definition: MoonwellSideBossDefinition,
): boolean {
  return Boolean(subject?.activityLog?.some(activity => (
    activity.type === 'battle'
    && (
      activity.id?.includes(definition.enemyId)
      || `${activity.title || ''} ${activity.source || ''} ${activity.description || ''}`
        .toLowerCase()
        .includes(`enemy:${definition.enemyId}`)
    )
  )));
}

export function shouldSpawnMoonwellSideBoss(
  subject: MoonwellSideSubject | null | undefined,
  definition: MoonwellSideBossDefinition,
): boolean {
  if (!subject || (subject.stats?.level || 1) < definition.minSpawnLevel) return false;
  if (!hasClaimedStoryQuest(subject, definition.unlockAfterQuestId)) return false;
  if (hasClaimedStoryQuest(subject, definition.completionQuestId)) return false;
  return !hasDefeatedMoonwellSideBoss(subject, definition);
}

export function getActiveMoonwellSideBoss(
  subject: MoonwellSideSubject | null | undefined,
): MoonwellSideBossDefinition | undefined {
  return MOONWELL_SIDE_BOSSES.find(definition => shouldSpawnMoonwellSideBoss(subject, definition));
}

export function hasSealedDrownedMoonwell(
  subject: MoonwellSideSubject | null | undefined,
): boolean {
  return hasClaimedStoryQuest(subject || {}, 'story-14-moonwell-sealed');
}
