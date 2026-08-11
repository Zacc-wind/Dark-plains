export interface LaterBandSideBossDefinition {
  id: 'ash-road-revenant' | 'glass-writ-forger' | 'synod-bell-reclaimer';
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

export interface LaterBandSideSubject {
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

export const LATER_BAND_SIDE_BOSSES: LaterBandSideBossDefinition[] = [
  {
    id: 'ash-road-revenant',
    enemyId: 'story-elite-ash-road-revenant',
    bossId: 'ash-road-revenant',
    level: 17,
    minSpawnLevel: 16,
    unlockAfterQuestId: 'story-15-broken-crown',
    completionQuestId: 'story-side-ash-clear',
    regionId: 'ashford-pilgrim-ash',
    storyLabel: 'Glass Road Side: Ash Pilgrim',
    lootMultiplier: 1.7,
    poiName: 'Witherfield Farm',
    poiFallback: { x: 22, y: 32 },
  },
  {
    id: 'glass-writ-forger',
    enemyId: 'story-elite-glass-writ-forger',
    bossId: 'glass-writ-forger',
    level: 18,
    minSpawnLevel: 17,
    unlockAfterQuestId: 'story-side-writ-cutters',
    completionQuestId: 'story-side-writ-clear',
    regionId: 'blackwater-forged-writs',
    storyLabel: 'Glass Road Side: Forged Writs',
    lootMultiplier: 1.8,
    poiName: 'East Road Camp',
    poiFallback: { x: 74, y: 18 },
  },
  {
    id: 'synod-bell-reclaimer',
    enemyId: 'story-elite-synod-bell',
    bossId: 'synod-bell-reclaimer',
    level: 22,
    minSpawnLevel: 21,
    unlockAfterQuestId: 'story-21-quarry-ledger',
    completionQuestId: 'story-side-synod-clear',
    regionId: 'eclipse-synod-bell',
    storyLabel: 'Candle Key Side: Synod Bell',
    lootMultiplier: 1.9,
    poiName: 'Eclipse Hold',
    poiFallback: { x: 69, y: 35 },
  },
];

function hasClaimedStoryQuest(subject: LaterBandSideSubject, questId: string): boolean {
  return Boolean(subject.storyQuests?.some(progress => progress.questId === questId && progress.claimed));
}

export function hasDefeatedLaterBandSideBoss(
  subject: LaterBandSideSubject | null | undefined,
  definition: LaterBandSideBossDefinition,
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

export function shouldSpawnLaterBandSideBoss(
  subject: LaterBandSideSubject | null | undefined,
  definition: LaterBandSideBossDefinition,
): boolean {
  if (!subject || (subject.stats?.level || 1) < definition.minSpawnLevel) return false;
  if (!hasClaimedStoryQuest(subject, definition.unlockAfterQuestId)) return false;
  if (hasClaimedStoryQuest(subject, definition.completionQuestId)) return false;
  return !hasDefeatedLaterBandSideBoss(subject, definition);
}

export function getActiveLaterBandSideBoss(
  subject: LaterBandSideSubject | null | undefined,
): LaterBandSideBossDefinition | undefined {
  return LATER_BAND_SIDE_BOSSES.find(definition => shouldSpawnLaterBandSideBoss(subject, definition));
}
