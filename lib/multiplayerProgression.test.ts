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
    expect(views.reduce((total, chapter) => total + chapter.questCount, 0)).toBe(30);
    expect(views[0]).toMatchObject({ unlocked: true, active: true, questCount: 6 });
    expect(views[1].unlocked).toBe(false);
  });

  it('moves the active marker after every quest in a chapter is claimed', () => {
    const firstChapter = getMultiplayerChapterViews({ stats: { level: 10 }, storyQuests: [] })[0];
    const storyQuests = firstChapter.quests.map(quest => ({ questId: quest.id, claimed: true, introSeen: true }));
    const views = getMultiplayerChapterViews({ stats: { level: 10 }, storyQuests });

    expect(views[0]).toMatchObject({ complete: true, active: false });
    expect(views[1]).toMatchObject({ unlocked: true, active: true });
  });
});
