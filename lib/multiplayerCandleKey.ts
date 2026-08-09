export interface CandleKeyStoryBossDefinition {
  id: 'ser-kael-elite' | 'key-saint-capstone';
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

export interface CandleKeySubject {
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

export const CANDLE_KEY_STORY_BOSSES: CandleKeyStoryBossDefinition[] = [
  {
    id: 'ser-kael-elite',
    enemyId: 'story-elite-ser-kael-duskplate',
    bossId: 'ser-kael-duskplate',
    level: 23,
    minSpawnLevel: 22,
    unlockAfterQuestId: 'story-22-eclipse-hold',
    completionQuestId: 'story-23-iron-chorus',
    regionId: 'candle-key-warden',
    storyLabel: 'Candle Key Elite',
    lootMultiplier: 2.1,
    poiName: 'Granite Heights Quarry',
  },
  {
    id: 'key-saint-capstone',
    enemyId: 'story-boss-key-saint-ardan',
    bossId: 'key-saint-ardan',
    level: 25,
    minSpawnLevel: 24,
    unlockAfterQuestId: 'story-24-candle-key',
    completionQuestId: 'story-25-paragon-muster',
    regionId: 'candle-key-saint',
    storyLabel: 'Candle Key Capstone',
    lootMultiplier: 2.5,
    poiName: 'Eclipse Hold',
  },
];

function hasClaimedStoryQuest(subject: CandleKeySubject, questId: string): boolean {
  return Boolean(subject.storyQuests?.some(progress => progress.questId === questId && progress.claimed));
}

export function hasDefeatedCandleKeyBoss(
  subject: CandleKeySubject | null | undefined,
  definition: CandleKeyStoryBossDefinition,
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

export function shouldSpawnCandleKeyBoss(
  subject: CandleKeySubject | null | undefined,
  definition: CandleKeyStoryBossDefinition,
): boolean {
  if (!subject || (subject.stats?.level || 1) < definition.minSpawnLevel) return false;
  if (!hasClaimedStoryQuest(subject, definition.unlockAfterQuestId)) return false;
  if (hasClaimedStoryQuest(subject, definition.completionQuestId)) return false;
  return !hasDefeatedCandleKeyBoss(subject, definition);
}

export function getActiveCandleKeyBoss(
  subject: CandleKeySubject | null | undefined,
): CandleKeyStoryBossDefinition | undefined {
  return CANDLE_KEY_STORY_BOSSES.find(definition => shouldSpawnCandleKeyBoss(subject, definition));
}
