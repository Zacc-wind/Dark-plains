export interface GlassRoadStoryBossDefinition {
  id: 'mirror-captain-elite' | 'prior-moon-capstone';
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

export interface GlassRoadSubject {
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

export const GLASS_ROAD_STORY_BOSSES: GlassRoadStoryBossDefinition[] = [
  {
    id: 'mirror-captain-elite',
    enemyId: 'story-elite-mirror-road-captain',
    bossId: 'mirror-road-captain',
    level: 19,
    minSpawnLevel: 18,
    unlockAfterQuestId: 'story-18-blackwater-gate',
    completionQuestId: 'story-19-eclipse-scouts',
    regionId: 'glass-road-scouts',
    storyLabel: 'Glass Road Elite',
    lootMultiplier: 2.0,
    poiName: 'Granite Heights Quarry',
  },
  {
    id: 'prior-moon-capstone',
    enemyId: 'story-boss-prior-moon-voss',
    bossId: 'prior-moon-voss',
    level: 20,
    minSpawnLevel: 19,
    unlockAfterQuestId: 'story-19-eclipse-scouts',
    completionQuestId: 'story-20-first-dungeon-oath',
    regionId: 'glass-road-ossuary',
    storyLabel: 'Glass Road Capstone',
    lootMultiplier: 2.4,
    poiName: 'Eclipse Hold',
  },
];

function hasClaimedStoryQuest(subject: GlassRoadSubject, questId: string): boolean {
  return Boolean(subject.storyQuests?.some(progress => progress.questId === questId && progress.claimed));
}

export function hasDefeatedGlassRoadBoss(
  subject: GlassRoadSubject | null | undefined,
  definition: GlassRoadStoryBossDefinition,
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

export function shouldSpawnGlassRoadBoss(
  subject: GlassRoadSubject | null | undefined,
  definition: GlassRoadStoryBossDefinition,
): boolean {
  if (!subject || (subject.stats?.level || 1) < definition.minSpawnLevel) return false;
  if (!hasClaimedStoryQuest(subject, definition.unlockAfterQuestId)) return false;
  if (hasClaimedStoryQuest(subject, definition.completionQuestId)) return false;
  return !hasDefeatedGlassRoadBoss(subject, definition);
}

export function getActiveGlassRoadBoss(
  subject: GlassRoadSubject | null | undefined,
): GlassRoadStoryBossDefinition | undefined {
  return GLASS_ROAD_STORY_BOSSES.find(definition => shouldSpawnGlassRoadBoss(subject, definition));
}
