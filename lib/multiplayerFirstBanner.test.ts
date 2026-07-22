import { describe, expect, it } from 'vitest';
import type { User } from '@/lib/auth';
import { getStoryQuestStatus } from '@/lib/auth';
import { getNpcEnemiesForUser } from '@/lib/battle';
import {
  FIRST_BANNER_BOSS_ENEMY_ID,
  FIRST_BANNER_BOSS_ID,
  hasDefeatedFirstBannerBoss,
  shouldSpawnFirstBannerBoss,
  type FirstBannerSubject,
} from '@/lib/multiplayerFirstBanner';

function makeSubject(overrides: Partial<FirstBannerSubject> = {}): FirstBannerSubject {
  return {
    stats: { level: 3 },
    storyQuests: [{ questId: 'story-05-violet-satchel', claimed: true }],
    activityLog: [],
    ...overrides,
  };
}

describe('First Banner capstone state', () => {
  it('injects the story boss into the real world-enemy roster', () => {
    const user = {
      username: 'FirstBannerSpawnTest',
      x: 24,
      y: 22,
      stats: { level: 3 },
      storyQuests: [{ questId: 'story-05-violet-satchel', claimed: true }],
      activityLog: [],
    } as unknown as User;

    const enemy = getNpcEnemiesForUser(user, Date.parse('2026-07-19T12:00:00Z'))
      .find(candidate => candidate.id === FIRST_BANNER_BOSS_ENEMY_ID);

    expect(enemy).toMatchObject({
      bossId: FIRST_BANNER_BOSS_ID,
      level: 5,
      spawnKind: 'story-boss',
      requiredPlayerLevel: 5,
    });
  });

  it('spawns the named threat only after the preceding quest and keeps it until defeat', () => {
    expect(shouldSpawnFirstBannerBoss(makeSubject({ stats: { level: 2 } }))).toBe(false);
    expect(shouldSpawnFirstBannerBoss(makeSubject({ storyQuests: [] }))).toBe(false);
    expect(shouldSpawnFirstBannerBoss(makeSubject())).toBe(true);

    const defeated = makeSubject({
      activityLog: [{
        id: `activity-battle-${FIRST_BANNER_BOSS_ENEMY_ID}-1`,
        type: 'battle',
        description: `boss:${FIRST_BANNER_BOSS_ID}`,
      }],
    });
    expect(hasDefeatedFirstBannerBoss(defeated)).toBe(true);
    expect(shouldSpawnFirstBannerBoss(defeated)).toBe(false);
  });

  it('does not respawn after the capstone reward is claimed', () => {
    expect(shouldSpawnFirstBannerBoss(makeSubject({
      storyQuests: [
        { questId: 'story-05-violet-satchel', claimed: true },
        { questId: 'story-07-broken-toll', claimed: true },
      ],
    }))).toBe(false);
  });

  it('completes the scout and capstone requirements only from their exact real events', () => {
    const baseStory = [
      'story-01-first-banner',
      'story-02-candle-road',
      'story-03-lost-apprentice',
      'story-04-river-law',
      'story-05-violet-satchel',
    ].map(questId => ({ questId, claimed: true, introSeen: true }));
    const scoutUser = {
      stats: { level: 3 },
      storyQuests: baseStory,
      multiplayerEngagement: {
        events: [{
          id: `enemy-inspected:${FIRST_BANNER_BOSS_ENEMY_ID}`,
          kind: 'enemy-inspected',
          targetId: FIRST_BANNER_BOSS_ENEMY_ID,
          completedAt: Date.now(),
        }],
      },
    } as unknown as User;

    expect(getStoryQuestStatus(scoutUser, 'story-06-black-pike')).toMatchObject({
      unlocked: true,
      complete: true,
      progress: 1,
    });

    const capstoneUser = {
      stats: { level: 5 },
      storyQuests: [...baseStory, { questId: 'story-06-black-pike', claimed: true, introSeen: true }],
      activityLog: [{
        id: `activity-battle-${FIRST_BANNER_BOSS_ENEMY_ID}-1`,
        type: 'battle',
        description: `boss:${FIRST_BANNER_BOSS_ID}`,
      }],
    } as unknown as User;
    expect(getStoryQuestStatus(capstoneUser, 'story-07-broken-toll')).toMatchObject({
      unlocked: true,
      complete: true,
      progress: 1,
    });

    expect(getStoryQuestStatus({
      ...capstoneUser,
      activityLog: [{ type: 'battle', description: `boss:${FIRST_BANNER_BOSS_ID}` }],
    } as User, 'story-07-broken-toll').complete).toBe(false);
  });

  it('requires a new Orren visit after the capstone instead of reusing the opening muster', () => {
    const completedAt = 1000;
    const storyQuests = [
      'story-01-first-banner',
      'story-02-candle-road',
      'story-03-lost-apprentice',
      'story-04-river-law',
      'story-05-violet-satchel',
      'story-06-black-pike',
      'story-07-broken-toll',
    ].map(questId => ({
      questId,
      claimed: true,
      introSeen: true,
      completedAt: questId === 'story-07-broken-toll' ? completedAt : completedAt - 500,
    }));
    const makeUser = (visitCompletedAt: number) => ({
      x: 38,
      y: 15,
      stats: { level: 5 },
      storyQuests,
      activityLog: [{
        type: 'quest',
        questNpcId: 'quest-npc-marshal-orren',
        completedAt: visitCompletedAt,
      }],
    } as unknown as User);

    expect(getStoryQuestStatus(makeUser(completedAt - 100), 'story-08-banner-recognized').complete).toBe(false);
    expect(getStoryQuestStatus(makeUser(completedAt + 100), 'story-08-banner-recognized')).toMatchObject({
      unlocked: true,
      complete: true,
      progress: 1,
    });
  });
});
