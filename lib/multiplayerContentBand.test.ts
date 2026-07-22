import { describe, expect, it } from 'vitest';
import { getMultiplayerChapterViews } from './multiplayerProgression';
import { CITY_QUESTS } from './questData';
import { getStoryDialogSequence } from './storyDialogue';

describe('levels 6-10 content band', () => {
  it('contains a complete nine-order Drowned Moonwell arc', () => {
    const chapter = getMultiplayerChapterViews({ stats: { level: 10 }, storyQuests: [] })[1];

    expect(chapter.quests.map(quest => quest.id)).toEqual([
      'story-09-moonwell-summons',
      'story-07-moonwell',
      'story-10-moonwell-tithe',
      'story-08-templar-seal',
      'story-10-blackroot-warning',
      'story-09-gravebound-script',
      'story-12-cindervein-warning',
      'story-10-field-council',
      'story-14-moonwell-sealed',
    ]);
    expect(chapter).toMatchObject({
      title: 'The Drowned Moonwell',
      questCount: 9,
      capstone: 'Mother Cindervein',
    });
    expect(chapter.quests[7].requirement).toMatchObject({
      type: 'defeat_boss',
      bossId: 'mother-cindervein',
      enemyId: 'story-boss-mother-cindervein',
    });
    expect(chapter.quests.filter(quest => quest.dialogId).every(quest => (
      Boolean(getStoryDialogSequence(quest.dialogId))
    ))).toBe(true);
  });

  it('adds a varied Moonbridge board without random unit rewards', () => {
    const moonbridge = CITY_QUESTS.filter(quest => quest.town === 'Moonbridge');
    const requirementTypes = new Set(moonbridge.map(quest => quest.requirement.type));

    expect(moonbridge).toHaveLength(8);
    expect(requirementTypes.size).toBeGreaterThanOrEqual(6);
    expect(CITY_QUESTS.some(quest => Boolean(quest.rewards.minionTier))).toBe(false);
  });

  it('gives Ashford a complete native contract rotation', () => {
    const ashford = CITY_QUESTS.filter(quest => quest.town === 'Ashford');
    const requirementTypes = new Set(ashford.map(quest => quest.requirement.type));

    expect(ashford).toHaveLength(5);
    expect(requirementTypes).toEqual(new Set([
      'complete_jobs_at_poi',
      'defeat_enemies_level',
      'collect_item',
      'clear_dungeons',
      'complete_timed_jobs',
    ]));
  });

  it('uses real thirty-minute thresholds for long city work', () => {
    const byId = new Map(CITY_QUESTS.map(quest => [quest.id, quest]));
    expect(byId.get('hv-blackwater-nets')?.requirement.minDuration).toBe(30 * 60 * 1000);
    expect(byId.get('rs-stone-hermit')?.requirement.minDuration).toBe(30 * 60 * 1000);
  });
});
