import { describe, expect, it } from 'vitest';
import {
  MULTIPLAYER_CHAPTER_DEFINITIONS,
  getMultiplayerChapterViews,
} from '@/lib/multiplayerProgression';

describe('multiplayer campaign presentation', () => {
  it('groups the existing story into six stable five-level chapters', () => {
    expect(MULTIPLAYER_CHAPTER_DEFINITIONS.map(chapter => [chapter.minLevel, chapter.maxLevel])).toEqual([
      [1, 5],
      [6, 10],
      [11, 15],
      [16, 20],
      [21, 25],
      [26, 30],
    ]);

    const views = getMultiplayerChapterViews({ stats: { level: 1 }, storyQuests: [] });
    expect(views).toHaveLength(6);
    expect(views.reduce((total, chapter) => total + chapter.questCount, 0)).toBe(40);
    expect(views[0]).toMatchObject({ unlocked: true, active: true, questCount: 8 });
    expect(views[1].unlocked).toBe(false);
  });

  it('ends the First Banner with a named scout objective and level-five capstone', () => {
    const chapter = getMultiplayerChapterViews({ stats: { level: 5 }, storyQuests: [] })[0];

    expect(chapter.quests.map(quest => quest.id)).toEqual([
      'story-01-first-banner',
      'story-02-candle-road',
      'story-03-lost-apprentice',
      'story-04-river-law',
      'story-05-violet-satchel',
      'story-06-black-pike',
      'story-07-broken-toll',
      'story-08-banner-recognized',
    ]);
    expect(chapter.quests[5]).toMatchObject({
      requiredLevel: 3,
      requirement: {
        type: 'inspect_enemy',
        enemyId: 'story-boss-black-pike-lieutenant',
      },
    });
    expect(chapter.quests[6]).toMatchObject({
      requiredLevel: 5,
      requirement: {
        type: 'defeat_boss',
        bossId: 'black-pike-lieutenant',
        enemyId: 'story-boss-black-pike-lieutenant',
      },
    });
    expect(chapter.quests[7]).toMatchObject({
      requiredLevel: 5,
      requirement: {
        type: 'visit_quest_npc',
        questNpcId: 'quest-npc-marshal-orren',
        afterQuestId: 'story-07-broken-toll',
      },
    });
  });

  it('moves the active marker after every quest in a chapter is claimed', () => {
    const firstChapter = getMultiplayerChapterViews({ stats: { level: 10 }, storyQuests: [] })[0];
    const storyQuests = firstChapter.quests.map(quest => ({ questId: quest.id, claimed: true, introSeen: true }));
    const views = getMultiplayerChapterViews({ stats: { level: 10 }, storyQuests });

    expect(views[0]).toMatchObject({ complete: true, active: false });
    expect(views[1]).toMatchObject({ unlocked: true, active: true });
  });
});
