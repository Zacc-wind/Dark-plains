export interface BrokenCrownStoryBossDefinition {
  id: 'iron-choir-elite' | 'grave-aurel-capstone';
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

export interface BrokenCrownSubject {
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

export const BROKEN_CROWN_STORY_BOSSES: BrokenCrownStoryBossDefinition[] = [
  {
    id: 'iron-choir-elite',
    enemyId: 'story-elite-iron-choir-marshal',
    bossId: 'iron-choir-marshal',
    level: 14,
    minSpawnLevel: 13,
    unlockAfterQuestId: 'story-13-paragon-vow',
    completionQuestId: 'story-14-eclipse-field',
    regionId: 'broken-crown-choir',
    storyLabel: 'Broken Crown Elite',
    lootMultiplier: 1.9,
    poiName: 'East Road Camp',
  },
  {
    id: 'grave-aurel-capstone',
    enemyId: 'story-boss-emperor-grave-aurel',
    bossId: 'emperor-grave-aurel',
    level: 15,
    minSpawnLevel: 14,
    unlockAfterQuestId: 'story-14-eclipse-field',
    completionQuestId: 'story-15-broken-crown',
    regionId: 'broken-crown-grave',
    storyLabel: 'Broken Crown Capstone',
    lootMultiplier: 2.3,
    poiName: 'Eclipse Hold',
  },
];

function hasClaimedStoryQuest(subject: BrokenCrownSubject, questId: string): boolean {
  return Boolean(subject.storyQuests?.some(progress => progress.questId === questId && progress.claimed));
}

export function hasDefeatedBrokenCrownBoss(
  subject: BrokenCrownSubject | null | undefined,
  definition: BrokenCrownStoryBossDefinition,
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

export function shouldSpawnBrokenCrownBoss(
  subject: BrokenCrownSubject | null | undefined,
  definition: BrokenCrownStoryBossDefinition,
): boolean {
  if (!subject || (subject.stats?.level || 1) < definition.minSpawnLevel) return false;
  if (!hasClaimedStoryQuest(subject, definition.unlockAfterQuestId)) return false;
  if (hasClaimedStoryQuest(subject, definition.completionQuestId)) return false;
  return !hasDefeatedBrokenCrownBoss(subject, definition);
}

export function getActiveBrokenCrownBoss(
  subject: BrokenCrownSubject | null | undefined,
): BrokenCrownStoryBossDefinition | undefined {
  return BROKEN_CROWN_STORY_BOSSES.find(definition => shouldSpawnBrokenCrownBoss(subject, definition));
}
