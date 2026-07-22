import { describe, expect, it } from 'vitest';
import type { User } from './auth';
import { getStoryQuestStatus } from './auth';
import { getNpcEnemiesForUser } from './battle';
import {
  DROWNED_MOONWELL_STORY_BOSSES,
  getActiveDrownedMoonwellBoss,
  hasDefeatedDrownedMoonwellBoss,
} from './multiplayerDrownedMoonwell';

const BLACKROOT_ENEMY_ID = 'story-elite-blackroot-vessel';
const CINDERVEIN_ENEMY_ID = 'story-boss-mother-cindervein';

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
  ];
  const end = questIds.indexOf(questId);
  return questIds.slice(0, end + 1).map((id, index) => ({
    questId: id,
    claimed: true,
    introSeen: true,
    completedAt: 1_000 + index,
  }));
}

describe('Drowned Moonwell story encounters', () => {
  it('spawns the Blackroot elite after Kaito and then the Cindervein capstone', () => {
    const blackrootUser = {
      username: 'MoonwellBlackrootSpawn',
      x: 30,
      y: 24,
      stats: { level: 8 },
      storyQuests: claimedThrough('story-08-templar-seal'),
      activityLog: [],
    } as unknown as User;

    expect(getActiveDrownedMoonwellBoss(blackrootUser)).toMatchObject({
      enemyId: BLACKROOT_ENEMY_ID,
      completionQuestId: 'story-09-gravebound-script',
    });
    expect(getNpcEnemiesForUser(blackrootUser, Date.parse('2026-07-22T12:00:00Z'))
      .find(enemy => enemy.id === BLACKROOT_ENEMY_ID)).toMatchObject({
      bossId: 'blackroot-vessel',
      level: 8,
      requiredPlayerLevel: 8,
      spawnKind: 'story-boss',
      storyLabel: 'Drowned Moonwell Elite',
    });

    const cinderveinUser = {
      ...blackrootUser,
      username: 'MoonwellCinderveinSpawn',
      stats: { level: 9 },
      storyQuests: claimedThrough('story-09-gravebound-script'),
      activityLog: [{
        id: `activity-battle-${BLACKROOT_ENEMY_ID}-2000`,
        type: 'battle',
        title: 'Defeated Blackroot Vessel',
        source: 'Battle',
        description: 'boss:blackroot-vessel',
      }],
    } as unknown as User;

    expect(getActiveDrownedMoonwellBoss(cinderveinUser)).toMatchObject({
      enemyId: CINDERVEIN_ENEMY_ID,
      completionQuestId: 'story-10-field-council',
    });
    expect(getNpcEnemiesForUser(cinderveinUser, Date.parse('2026-07-22T12:00:00Z'))
      .find(enemy => enemy.id === CINDERVEIN_ENEMY_ID)).toMatchObject({
      bossId: 'mother-cindervein',
      level: 10,
      requiredPlayerLevel: 10,
      spawnKind: 'story-boss',
      storyLabel: 'Drowned Moonwell Capstone',
    });
  });

  it('does not accept a rotating boss with the same profile as the named story encounter', () => {
    const definition = DROWNED_MOONWELL_STORY_BOSSES[0];
    const genericReceipt = {
      activityLog: [{ type: 'battle', description: 'boss:blackroot-vessel' }],
    };
    const exactReceipt = {
      activityLog: [{
        id: `activity-battle-${BLACKROOT_ENEMY_ID}-1`,
        type: 'battle',
        description: 'boss:blackroot-vessel',
      }],
    };

    expect(hasDefeatedDrownedMoonwellBoss(genericReceipt, definition)).toBe(false);
    expect(hasDefeatedDrownedMoonwellBoss(exactReceipt, definition)).toBe(true);
  });

  it('completes inspection and defeat objectives only from their exact events', () => {
    const previous = claimedThrough('story-08-templar-seal');
    const inspected = {
      stats: { level: 8 },
      storyQuests: previous,
      multiplayerEngagement: {
        events: [{
          id: `enemy-inspected:${BLACKROOT_ENEMY_ID}`,
          kind: 'enemy-inspected',
          targetId: BLACKROOT_ENEMY_ID,
          completedAt: 2_000,
        }],
      },
    } as unknown as User;
    expect(getStoryQuestStatus(inspected, 'story-10-blackroot-warning').complete).toBe(true);

    const defeatBase = {
      stats: { level: 8 },
      storyQuests: claimedThrough('story-10-blackroot-warning'),
    };
    expect(getStoryQuestStatus({
      ...defeatBase,
      activityLog: [{ type: 'battle', description: 'boss:blackroot-vessel' }],
    } as unknown as User, 'story-09-gravebound-script').complete).toBe(false);
    expect(getStoryQuestStatus({
      ...defeatBase,
      activityLog: [{
        id: `activity-battle-${BLACKROOT_ENEMY_ID}-1`,
        type: 'battle',
        description: 'boss:blackroot-vessel',
      }],
    } as unknown as User, 'story-09-gravebound-script').complete).toBe(true);
  });
});
