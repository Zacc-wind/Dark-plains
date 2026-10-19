export interface BrokenCrownSideBossDefinition {
  id: 'iron-choir-cantor';
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
  poiFallback: { x: number; y: number };
}

export interface BrokenCrownSideSubject {
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

export const BROKEN_CROWN_SIDE_BOSSES: BrokenCrownSideBossDefinition[] = [
  {
    id: 'iron-choir-cantor',
    enemyId: 'story-elite-iron-choir-cantor',
    bossId: 'iron-choir-cantor',
    level: 14,
    minSpawnLevel: 13,
    unlockAfterQuestId: 'story-12-choir-of-iron',
    completionQuestId: 'story-side-choir-clear',
    regionId: 'broken-crown-choir-practice',
    storyLabel: 'Broken Crown Side: Choir Practice',
    lootMultiplier: 1.7,
    poiName: 'East Road Camp',
    poiFallback: { x: 74, y: 18 },
  },
];

function hasClaimedStoryQuest(subject: BrokenCrownSideSubject, questId: string): boolean {
  return Boolean(subject.storyQuests?.some(progress => progress.questId === questId && progress.claimed));
}

export function hasDefeatedBrokenCrownSideBoss(
  subject: BrokenCrownSideSubject | null | undefined,
  definition: BrokenCrownSideBossDefinition,
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

export function shouldSpawnBrokenCrownSideBoss(
  subject: BrokenCrownSideSubject | null | undefined,
  definition: BrokenCrownSideBossDefinition,
): boolean {
  if (!subject || (subject.stats?.level || 1) < definition.minSpawnLevel) return false;
  if (!hasClaimedStoryQuest(subject, definition.unlockAfterQuestId)) return false;
  if (hasClaimedStoryQuest(subject, definition.completionQuestId)) return false;
  return !hasDefeatedBrokenCrownSideBoss(subject, definition);
}

export function getActiveBrokenCrownSideBoss(
  subject: BrokenCrownSideSubject | null | undefined,
): BrokenCrownSideBossDefinition | undefined {
  return BROKEN_CROWN_SIDE_BOSSES.find(definition => shouldSpawnBrokenCrownSideBoss(subject, definition));
}

