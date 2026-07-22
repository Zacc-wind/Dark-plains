export interface DrownedMoonwellStoryBossDefinition {
  id: 'blackroot-elite' | 'cindervein-capstone';
  enemyId: string;
  bossId: string;
  level: number;
  minSpawnLevel: number;
  unlockAfterQuestId: string;
  completionQuestId: string;
  regionId: string;
  storyLabel: string;
  lootMultiplier: number;
}

export interface DrownedMoonwellSubject {
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

export const DROWNED_MOONWELL_STORY_BOSSES: DrownedMoonwellStoryBossDefinition[] = [
  {
    id: 'blackroot-elite',
    enemyId: 'story-elite-blackroot-vessel',
    bossId: 'blackroot-vessel',
    level: 8,
    minSpawnLevel: 7,
    unlockAfterQuestId: 'story-08-templar-seal',
    completionQuestId: 'story-09-gravebound-script',
    regionId: 'moonwell-blackroot',
    storyLabel: 'Drowned Moonwell Elite',
    lootMultiplier: 1.8,
  },
  {
    id: 'cindervein-capstone',
    enemyId: 'story-boss-mother-cindervein',
    bossId: 'mother-cindervein',
    level: 10,
    minSpawnLevel: 9,
    unlockAfterQuestId: 'story-09-gravebound-script',
    completionQuestId: 'story-10-field-council',
    regionId: 'drowned-moonwell',
    storyLabel: 'Drowned Moonwell Capstone',
    lootMultiplier: 2.2,
  },
];

function hasClaimedStoryQuest(subject: DrownedMoonwellSubject, questId: string): boolean {
  return Boolean(subject.storyQuests?.some(progress => progress.questId === questId && progress.claimed));
}

export function hasDefeatedDrownedMoonwellBoss(
  subject: DrownedMoonwellSubject | null | undefined,
  definition: DrownedMoonwellStoryBossDefinition,
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

export function shouldSpawnDrownedMoonwellBoss(
  subject: DrownedMoonwellSubject | null | undefined,
  definition: DrownedMoonwellStoryBossDefinition,
): boolean {
  if (!subject || (subject.stats?.level || 1) < definition.minSpawnLevel) return false;
  if (!hasClaimedStoryQuest(subject, definition.unlockAfterQuestId)) return false;
  if (hasClaimedStoryQuest(subject, definition.completionQuestId)) return false;
  return !hasDefeatedDrownedMoonwellBoss(subject, definition);
}

export function getActiveDrownedMoonwellBoss(
  subject: DrownedMoonwellSubject | null | undefined,
): DrownedMoonwellStoryBossDefinition | undefined {
  return DROWNED_MOONWELL_STORY_BOSSES.find(definition => (
    shouldSpawnDrownedMoonwellBoss(subject, definition)
  ));
}
