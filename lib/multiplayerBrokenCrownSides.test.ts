import { describe, expect, it } from 'vitest';
import type { User } from './auth';
import { getNpcEnemiesForUser } from './battle';
import { getActiveBrokenCrownSideBoss } from './multiplayerBrokenCrownSides';
import { getStoryQuestStatus } from './auth';

function claimedThrough(questId: string) {
  const questIds = [
    'story-01-first-banner',
    'story-02-candle-road',
    'story-03-lost-apprentice',
    'story-04-river-law',
    'story-05-violet-satchel',
    'story-06-black-pike',
    'story-07-broken-toll',
    'story-08-banner-recognized',
    'story-09-moonwell-summons',
    'story-07-moonwell',
    'story-10-moonwell-tithe',
    'story-08-templar-seal',
    'story-10-blackroot-warning',
    'story-09-gravebound-script',
    'story-12-cindervein-warning',
    'story-10-field-council',
    'story-14-moonwell-sealed',
    'story-11-eastward-march',
    'story-12-choir-of-iron',
  ];
  const end = questIds.indexOf(questId);
  return questIds.slice(0, end + 1).map((id, index) => ({
    questId: id,
    claimed: true,
    introSeen: true,
    completedAt: 1_000 + index,
  }));
}

describe('Broken Crown side story — Choir Practice', () => {
  it('spawns the Iron Choir Cantor after Blackwater Gate for the choir side chain', () => {
    const user = {
      username: 'ChoirPracticeSpawn',
      x: 74,
      y: 18,
      stats: { level: 14 },
      storyQuests: claimedThrough('story-12-choir-of-iron'),
      activityLog: [],
    } as unknown as User;

    expect(getActiveBrokenCrownSideBoss(user)).toMatchObject({
      enemyId: 'story-elite-iron-choir-cantor',
      bossId: 'iron-choir-cantor',
    });
    expect(getNpcEnemiesForUser(user, Date.parse('2026-08-09T12:00:00Z'))
      .find(enemy => enemy.id === 'story-elite-iron-choir-cantor')).toMatchObject({
      spawnKind: 'story-boss',
      storyLabel: 'Broken Crown Side: Choir Practice',
    });
  });

  it('unlocks the choir side without blocking Broken Crown mainline quests', () => {
    const user = {
      username: 'ChoirSideGates',
      stats: { level: 13 },
      storyQuests: claimedThrough('story-12-choir-of-iron'),
    } as unknown as User;

    expect(getStoryQuestStatus(user, 'story-13-paragon-vow').unlocked).toBe(true);
    expect(getStoryQuestStatus(user, 'story-side-choir-scout').unlocked).toBe(true);
  });
});

