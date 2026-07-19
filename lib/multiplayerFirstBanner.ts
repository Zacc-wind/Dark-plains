export const FIRST_BANNER_SCOUT_QUEST_ID = 'story-06-black-pike';
export const FIRST_BANNER_CAPSTONE_QUEST_ID = 'story-07-broken-toll';
export const FIRST_BANNER_BOSS_ID = 'black-pike-lieutenant';
export const FIRST_BANNER_BOSS_ENEMY_ID = 'story-boss-black-pike-lieutenant';
export const FIRST_BANNER_BOSS_LEVEL = 5;

export interface FirstBannerSubject {
  stats?: { level?: number } | null;
  storyQuests?: Array<{
    questId: string;
    claimed?: boolean;
  }> | null;
  activityLog?: Array<{
    type?: string;
    title?: string;
    source?: string;
    description?: string;
  }> | null;
}

export function hasDefeatedFirstBannerBoss(subject: FirstBannerSubject | null | undefined): boolean {
  return (subject?.activityLog || []).some(activity => {
    if (activity.type !== 'battle') return false;
    const receipt = `${activity.title || ''} ${activity.source || ''} ${activity.description || ''}`.toLowerCase();
    return receipt.includes(FIRST_BANNER_BOSS_ID) || receipt.includes('black pike lieutenant');
  });
}

export function shouldSpawnFirstBannerBoss(subject: FirstBannerSubject | null | undefined): boolean {
  if (!subject || (subject.stats?.level || 1) < 3) return false;
  const progress = subject.storyQuests || [];
  const scoutAvailable = progress.some(entry => entry.questId === 'story-05-violet-satchel' && entry.claimed);
  const capstoneClaimed = progress.some(entry => entry.questId === FIRST_BANNER_CAPSTONE_QUEST_ID && entry.claimed);
  return scoutAvailable && !capstoneClaimed && !hasDefeatedFirstBannerBoss(subject);
}
