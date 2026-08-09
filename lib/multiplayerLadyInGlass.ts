export interface LadyInGlassStoryBossDefinition {
  id: 'scarlet-matron-elite' | 'lady-veyra-capstone';
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

export interface LadyInGlassSubject {
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

export const LADY_IN_GLASS_STORY_BOSSES: LadyInGlassStoryBossDefinition[] = [
  {
    id: 'scarlet-matron-elite',
    enemyId: 'story-elite-scarlet-matron',
    bossId: 'scarlet-matron-yvane',
    level: 28,
    minSpawnLevel: 27,
    unlockAfterQuestId: 'story-27-mirror-envoy',
    completionQuestId: 'story-28-eclipse-field',
    regionId: 'lady-scarlet-matron',
    storyLabel: 'Lady In Glass Elite',
    lootMultiplier: 2.2,
    poiName: 'Shadowgrove',
  },
  {
    id: 'lady-veyra-capstone',
    enemyId: 'story-boss-lady-mirror-veyra',
    bossId: 'lady-mirror-veyra',
    level: 30,
    minSpawnLevel: 29,
    unlockAfterQuestId: 'story-28-eclipse-field',
    completionQuestId: 'story-30-lady-in-glass',
    regionId: 'lady-mirror-court',
    storyLabel: 'Lady In Glass Capstone',
    lootMultiplier: 2.6,
    poiName: 'Eclipse Hold',
  },
];

function hasClaimedStoryQuest(subject: LadyInGlassSubject, questId: string): boolean {
  return Boolean(subject.storyQuests?.some(progress => progress.questId === questId && progress.claimed));
}

export function hasDefeatedLadyInGlassBoss(
  subject: LadyInGlassSubject | null | undefined,
  definition: LadyInGlassStoryBossDefinition,
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

export function shouldSpawnLadyInGlassBoss(
  subject: LadyInGlassSubject | null | undefined,
  definition: LadyInGlassStoryBossDefinition,
): boolean {
  if (!subject || (subject.stats?.level || 1) < definition.minSpawnLevel) return false;
  if (!hasClaimedStoryQuest(subject, definition.unlockAfterQuestId)) return false;
  if (hasClaimedStoryQuest(subject, definition.completionQuestId)) return false;
  return !hasDefeatedLadyInGlassBoss(subject, definition);
}

export function getActiveLadyInGlassBoss(
  subject: LadyInGlassSubject | null | undefined,
): LadyInGlassStoryBossDefinition | undefined {
  return LADY_IN_GLASS_STORY_BOSSES.find(definition => shouldSpawnLadyInGlassBoss(subject, definition));
}
