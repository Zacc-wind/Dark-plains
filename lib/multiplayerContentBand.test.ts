import { describe, expect, it } from 'vitest';
import { getMultiplayerChapterViews } from './multiplayerProgression';
import { CITY_QUESTS, getAllStoryQuestsSorted } from './questData';
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

    expect(moonbridge).toHaveLength(9);
    expect(requirementTypes.size).toBeGreaterThanOrEqual(6);
    expect(CITY_QUESTS.some(quest => Boolean(quest.rewards.minionTier))).toBe(false);
    expect(moonbridge.find(quest => quest.id === 'mb-eastern-march-preview')).toMatchObject({
      requiresClaimedQuestId: 'story-14-moonwell-sealed',
    });
  });

  it('keeps Moonwell side stories outside the main chapter counter', () => {
    const chapter = getMultiplayerChapterViews({ stats: { level: 10 }, storyQuests: [] })[1];
    expect(chapter.questCount).toBe(9);
    expect(chapter.quests.every(quest => quest.track !== 'side')).toBe(true);
  });

  it('gives Ashford a complete native contract rotation', () => {
    const ashford = CITY_QUESTS.filter(quest => quest.town === 'Ashford');
    const requirementTypes = new Set(ashford.map(quest => quest.requirement.type));

    expect(ashford).toHaveLength(8);
    expect(requirementTypes.size).toBeGreaterThanOrEqual(7);
    expect(requirementTypes).toEqual(new Set([
      'complete_jobs_at_poi',
      'defeat_enemies_level',
      'collect_item',
      'clear_dungeons',
      'complete_timed_jobs',
      'visit_poi',
      'win_battles',
      'own_rare_gems',
    ]));
  });

  it('keeps Harborview and Riverside boards at eight contracts', () => {
    const harborview = CITY_QUESTS.filter(quest => quest.town === 'Harborview');
    const riverside = CITY_QUESTS.filter(quest => quest.town === 'Riverside');
    const harborTypes = new Set(harborview.map(quest => quest.requirement.type));
    const riverTypes = new Set(riverside.map(quest => quest.requirement.type));

    expect(harborview).toHaveLength(8);
    expect(riverside).toHaveLength(8);
    expect(harborTypes.size).toBeGreaterThanOrEqual(6);
    expect(riverTypes.size).toBeGreaterThanOrEqual(6);
    expect(harborview.map(quest => quest.id)).toEqual([
      'hv-candle-watch',
      'hv-salt-vigil',
      'hv-blackwater-nets',
      'hv-hospitaller-round',
      'hv-violet-tithe',
      'hv-drowned-catechism',
      'hv-starless-writ',
      'hv-harbor-marshal',
    ]);
    expect(riverside.map(quest => quest.id)).toEqual([
      'rs-bridge-bells',
      'rs-ancestor-masks',
      'rs-bitter-beans',
      'rs-violet-current',
      'rs-stone-hermit',
      'rs-bell-tower-keys',
      'rs-black-lotus',
      'rs-riverside-marshal',
    ]);
  });

  it('uses real thirty-minute thresholds for long city work', () => {
    const byId = new Map(CITY_QUESTS.map(quest => [quest.id, quest]));
    expect(byId.get('hv-blackwater-nets')?.requirement.minDuration).toBe(30 * 60 * 1000);
    expect(byId.get('rs-stone-hermit')?.requirement.minDuration).toBe(30 * 60 * 1000);
  });
});

describe('levels 11-15 content band', () => {
  it('replaces Broken Crown counter stubs with named places and encounters', () => {
    const chapter = getMultiplayerChapterViews({ stats: { level: 15 }, storyQuests: [] })[2];

    expect(chapter).toMatchObject({
      title: 'The Broken Crown',
      questCount: 5,
      guideName: 'Ash Hermit Yara and Veil Captain Serat',
      capstone: 'Emperor Grave-Aurel',
    });
    expect(chapter.quests.map(quest => quest.id)).toEqual([
      'story-11-eastward-march',
      'story-12-choir-of-iron',
      'story-13-paragon-vow',
      'story-14-eclipse-field',
      'story-15-broken-crown',
    ]);
    expect(chapter.quests.every(quest => (
      quest.requirement.type !== 'complete_jobs'
      && quest.requirement.type !== 'complete_timed_jobs'
      && quest.requirement.type !== 'recruit_minions'
      && quest.requirement.type !== 'win_battles'
    ))).toBe(true);
    expect(chapter.quests[3].requirement).toMatchObject({
      type: 'defeat_boss',
      bossId: 'iron-choir-marshal',
      enemyId: 'story-elite-iron-choir-marshal',
    });
    expect(chapter.quests[4].requirement).toMatchObject({
      type: 'defeat_boss',
      bossId: 'emperor-grave-aurel',
      enemyId: 'story-boss-emperor-grave-aurel',
    });
    expect(chapter.quests.filter(quest => quest.dialogId).every(quest => (
      Boolean(getStoryDialogSequence(quest.dialogId))
    ))).toBe(true);
  });
});

describe('levels 16-20 content band', () => {
  it('ships Glass Road as named contacts, elite, Prior Moon Voss, and return', () => {
    const chapter = getMultiplayerChapterViews({ stats: { level: 20 }, storyQuests: [] })[3];

    expect(chapter).toMatchObject({
      title: 'The Glass Road',
      questCount: 6,
      guideName: 'Gate Warden Sable and Veil Captain Serat',
      capstone: 'Prior Moon Voss',
    });
    expect(chapter.quests.map(quest => quest.id)).toEqual([
      'story-16-mirror-council',
      'story-17-moonwell-contract',
      'story-18-blackwater-gate',
      'story-19-eclipse-scouts',
      'story-20-first-dungeon-oath',
      'story-20-glass-sealed',
    ]);
    expect(chapter.quests[3].requirement).toMatchObject({
      type: 'defeat_boss',
      bossId: 'mirror-road-captain',
      enemyId: 'story-elite-mirror-road-captain',
    });
    expect(chapter.quests[4].requirement).toMatchObject({
      type: 'defeat_boss',
      bossId: 'prior-moon-voss',
      enemyId: 'story-boss-prior-moon-voss',
    });
    expect(chapter.quests.every(quest => Boolean(quest.dialogId) && Boolean(getStoryDialogSequence(quest.dialogId)))).toBe(true);
  });

  it('fills Blackwater Gate and Eclipse Hold boards to eight contracts', () => {
    expect(CITY_QUESTS.filter(quest => quest.town === 'Blackwater Gate')).toHaveLength(8);
    expect(CITY_QUESTS.filter(quest => quest.town === 'Eclipse Hold')).toHaveLength(8);
  });

  it('keeps Glass Road side stories outside the main chapter counter', () => {
    const chapter = getMultiplayerChapterViews({ stats: { level: 20 }, storyQuests: [] })[3];
    expect(chapter.questCount).toBe(6);
    expect(chapter.quests.every(quest => quest.track !== 'side')).toBe(true);
  });
});

describe('levels 16-30 later-band side stories', () => {
  it('ships three three-step side chains with authored dialogue', () => {
    const sideIds = [
      'story-side-ash-scout',
      'story-side-ash-clear',
      'story-side-ash-return',
      'story-side-writ-cutters',
      'story-side-writ-clear',
      'story-side-writ-return',
      'story-side-synod-scout',
      'story-side-synod-clear',
      'story-side-synod-return',
    ];
    const sideQuests = getAllStoryQuestsSorted().filter(quest => sideIds.includes(quest.id));
    const glassChapter = getMultiplayerChapterViews({ stats: { level: 20 }, storyQuests: [] })[3];
    const candleChapter = getMultiplayerChapterViews({ stats: { level: 25 }, storyQuests: [] })[4];

    expect(sideQuests).toHaveLength(9);
    expect(sideQuests.every(quest => quest.track === 'side')).toBe(true);
    expect(sideQuests.every(quest => quest.requiredLevel >= 16 && quest.requiredLevel <= 30)).toBe(true);
    expect(sideIds.every(id => Boolean(getStoryDialogSequence(id)))).toBe(true);
    expect(glassChapter.quests.every(quest => quest.track !== 'side')).toBe(true);
    expect(candleChapter.quests.every(quest => quest.track !== 'side')).toBe(true);
  });
});

describe('levels 21-25 content band', () => {
  it('ships Candle Key as named contacts, Ser Kael elite, Key-Saint Ardan, and return', () => {
    const chapter = getMultiplayerChapterViews({ stats: { level: 25 }, storyQuests: [] })[4];

    expect(chapter).toMatchObject({
      title: 'The Candle Key',
      questCount: 6,
      guideName: 'Brother Kaito and Archivist Letho',
      capstone: 'Key-Saint Ardan',
    });
    expect(chapter.quests.map(quest => quest.id)).toEqual([
      'story-21-quarry-ledger',
      'story-22-eclipse-hold',
      'story-23-iron-chorus',
      'story-24-candle-key',
      'story-25-paragon-muster',
      'story-25-key-sealed',
    ]);
    expect(chapter.quests[2].requirement).toMatchObject({
      type: 'defeat_boss',
      bossId: 'ser-kael-duskplate',
      enemyId: 'story-elite-ser-kael-duskplate',
    });
    expect(chapter.quests[4].requirement).toMatchObject({
      type: 'defeat_boss',
      bossId: 'key-saint-ardan',
      enemyId: 'story-boss-key-saint-ardan',
    });
    expect(chapter.quests.every(quest => Boolean(quest.dialogId) && Boolean(getStoryDialogSequence(quest.dialogId)))).toBe(true);
  });
});

describe('levels 26-30 content band', () => {
  it('ships Lady in Glass as Letho contacts, Scarlet Matron elite, Lady Mirror-Veyra, and return', () => {
    const chapter = getMultiplayerChapterViews({ stats: { level: 30 }, storyQuests: [] })[5];

    expect(chapter).toMatchObject({
      title: 'The Lady In Glass',
      questCount: 6,
      guideName: 'Archivist Letho',
      capstone: 'Lady Mirror Veyra',
    });
    expect(chapter.quests.map(quest => quest.id)).toEqual([
      'story-26-deep-dungeon',
      'story-27-mirror-envoy',
      'story-28-eclipse-field',
      'story-29-high-war',
      'story-30-lady-in-glass',
      'story-30-court-sealed',
    ]);
    expect(chapter.quests[2].requirement).toMatchObject({
      type: 'defeat_boss',
      bossId: 'scarlet-matron-yvane',
      enemyId: 'story-elite-scarlet-matron',
    });
    expect(chapter.quests[4].requirement).toMatchObject({
      type: 'defeat_boss',
      bossId: 'lady-mirror-veyra',
      enemyId: 'story-boss-lady-mirror-veyra',
    });
    expect(chapter.quests.every(quest => Boolean(quest.dialogId) && Boolean(getStoryDialogSequence(quest.dialogId)))).toBe(true);
  });
});
