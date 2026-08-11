import { describe, expect, it } from 'vitest';
import type { User } from './auth';
import { getStoryQuestStatus } from './auth';
import { getNpcEnemiesForUser } from './battle';
import { getActiveBrokenCrownBoss } from './multiplayerBrokenCrown';
import { getActiveCandleKeyBoss } from './multiplayerCandleKey';
import { getActiveGlassRoadBoss } from './multiplayerGlassRoad';
import { getActiveLadyInGlassBoss } from './multiplayerLadyInGlass';
import { getActiveMoonwellSideBoss, hasSealedDrownedMoonwell } from './multiplayerMoonwellSides';
import { getActiveLaterBandSideBoss } from './multiplayerLaterBandSides';
import { getQuestNpcById, getQuestNpcWorldVoice, getRotatingCityQuests } from './questData';

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
    'story-13-paragon-vow',
    'story-14-eclipse-field',
    'story-15-broken-crown',
  ];
  const end = questIds.indexOf(questId);
  return questIds.slice(0, end + 1).map((id, index) => ({
    questId: id,
    claimed: true,
    introSeen: true,
    completedAt: 1_000 + index,
  }));
}

describe('Moonwell side stories and post-chapter response', () => {
  it('spawns the Moonfen brood after the pier visit for the silk side chain', () => {
    const user = {
      username: 'MoonwellSilkSpawn',
      x: 36,
      y: 28,
      stats: { level: 8 },
      storyQuests: claimedThrough('story-07-moonwell'),
      activityLog: [],
    } as unknown as User;

    expect(getActiveMoonwellSideBoss(user)).toMatchObject({
      enemyId: 'story-elite-moonfen-brood',
      bossId: 'moonfen-brood-mother',
    });
    expect(getNpcEnemiesForUser(user, Date.parse('2026-08-09T12:00:00Z'))
      .find(enemy => enemy.id === 'story-elite-moonfen-brood')).toMatchObject({
      spawnKind: 'story-boss',
      storyLabel: 'Moonwell Side: Silk Nest',
    });
  });

  it('unlocks side stories without blocking Broken Crown mainline', () => {
    const user = {
      username: 'SideDoesNotGate',
      stats: { level: 11 },
      storyQuests: claimedThrough('story-14-moonwell-sealed'),
    } as unknown as User;

    expect(getStoryQuestStatus(user, 'story-11-eastward-march').unlocked).toBe(true);
    expect(getStoryQuestStatus(user, 'story-side-silk-scout').unlocked).toBe(true);
    expect(getStoryQuestStatus(user, 'story-side-tithe-cutters').unlocked).toBe(true);
  });

  it('changes Naima\'s world voice and unlocks the eastern march preview contract after the chapter seals', () => {
    const sealed = {
      storyQuests: [{ questId: 'story-14-moonwell-sealed', claimed: true }],
    };
    const naima = getQuestNpcById('quest-npc-scribe-naima');
    expect(naima).toBeTruthy();
    expect(hasSealedDrownedMoonwell(sealed)).toBe(true);
    expect(getQuestNpcWorldVoice(naima!, sealed).line).toContain('iron choir');

    const locked = getRotatingCityQuests('Moonbridge', Date.now(), 9, { claimedStoryQuestIds: [] });
    expect(locked.some(quest => quest.id === 'mb-eastern-march-preview')).toBe(false);

    const unlocked = getRotatingCityQuests('Moonbridge', Date.now(), 9, {
      claimedStoryQuestIds: ['story-14-moonwell-sealed'],
    });
    expect(unlocked.some(quest => quest.id === 'mb-eastern-march-preview')).toBe(true);
  });
});

describe('Later-band side stories', () => {
  it('spawns the Ash Road Revenant after Broken Crown for the ash pilgrim side chain', () => {
    const user = {
      username: 'AshPilgrimSpawn',
      x: 22,
      y: 32,
      stats: { level: 17 },
      storyQuests: claimedThrough('story-15-broken-crown'),
      activityLog: [],
    } as unknown as User;

    expect(getActiveLaterBandSideBoss(user)).toMatchObject({
      enemyId: 'story-elite-ash-road-revenant',
      bossId: 'ash-road-revenant',
    });
    expect(getNpcEnemiesForUser(user, Date.parse('2026-08-09T12:00:00Z'))
      .find(enemy => enemy.id === 'story-elite-ash-road-revenant')).toMatchObject({
      spawnKind: 'story-boss',
      storyLabel: 'Glass Road Side: Ash Pilgrim',
    });
  });

  it('unlocks Glass Road and Candle Key sides without blocking mainline chapter counts', () => {
    const glassUser = {
      username: 'WritSideOpen',
      stats: { level: 17 },
      storyQuests: [
        ...claimedThrough('story-15-broken-crown'),
        { questId: 'story-16-mirror-council', claimed: true },
        { questId: 'story-17-moonwell-contract', claimed: true },
      ],
    } as unknown as User;
    const candleUser = {
      username: 'SynodSideOpen',
      stats: { level: 21 },
      storyQuests: [
        ...claimedThrough('story-15-broken-crown'),
        { questId: 'story-16-mirror-council', claimed: true },
        { questId: 'story-17-moonwell-contract', claimed: true },
        { questId: 'story-18-blackwater-gate', claimed: true },
        { questId: 'story-19-eclipse-scouts', claimed: true },
        { questId: 'story-20-first-dungeon-oath', claimed: true },
        { questId: 'story-20-glass-sealed', claimed: true },
        { questId: 'story-21-quarry-ledger', claimed: true },
      ],
    } as unknown as User;

    expect(getStoryQuestStatus(glassUser, 'story-side-ash-scout').unlocked).toBe(true);
    expect(getStoryQuestStatus(glassUser, 'story-side-writ-cutters').unlocked).toBe(true);
    expect(getStoryQuestStatus(candleUser, 'story-side-synod-scout').unlocked).toBe(true);
    expect(getStoryQuestStatus(candleUser, 'story-21-quarry-ledger').claimed).toBe(true);
  });
});

describe('Broken Crown story encounters', () => {
  it('spawns the Iron Choir Marshal after Serat, then Grave-Aurel after the choir falls', () => {
    const choirUser = {
      username: 'BrokenCrownChoir',
      x: 60,
      y: 20,
      stats: { level: 14 },
      storyQuests: claimedThrough('story-13-paragon-vow'),
      activityLog: [],
    } as unknown as User;

    expect(getActiveBrokenCrownBoss(choirUser)).toMatchObject({
      enemyId: 'story-elite-iron-choir-marshal',
      completionQuestId: 'story-14-eclipse-field',
    });
    expect(getNpcEnemiesForUser(choirUser, Date.parse('2026-08-09T12:00:00Z'))
      .find(enemy => enemy.id === 'story-elite-iron-choir-marshal')).toMatchObject({
      bossId: 'iron-choir-marshal',
      level: 14,
      spawnKind: 'story-boss',
    });

    const capstoneUser = {
      ...choirUser,
      username: 'BrokenCrownCapstone',
      stats: { level: 15 },
      storyQuests: claimedThrough('story-14-eclipse-field'),
      activityLog: [{
        id: 'activity-battle-story-elite-iron-choir-marshal-1',
        type: 'battle',
        title: 'Defeated Iron Choir Marshal',
        description: 'enemy:story-elite-iron-choir-marshal',
      }],
    } as unknown as User;

    expect(getActiveBrokenCrownBoss(capstoneUser)).toMatchObject({
      enemyId: 'story-boss-emperor-grave-aurel',
      bossId: 'emperor-grave-aurel',
    });
    expect(getNpcEnemiesForUser(capstoneUser, Date.parse('2026-08-09T12:00:00Z'))
      .find(enemy => enemy.id === 'story-boss-emperor-grave-aurel')).toMatchObject({
      level: 15,
      storyLabel: 'Broken Crown Capstone',
    });
  });
});

describe('Glass Road story encounters', () => {
  it('spawns the Mirror Road Captain after Blackwater Gate, then Prior Moon Voss', () => {
    const captainUser = {
      username: 'GlassRoadCaptain',
      x: 50,
      y: 17,
      stats: { level: 19 },
      storyQuests: [
        ...claimedThrough('story-15-broken-crown'),
        { questId: 'story-16-mirror-council', claimed: true, introSeen: true, completedAt: 2000 },
        { questId: 'story-17-moonwell-contract', claimed: true, introSeen: true, completedAt: 2001 },
        { questId: 'story-18-blackwater-gate', claimed: true, introSeen: true, completedAt: 2002 },
      ],
      activityLog: [],
    } as unknown as User;

    expect(getActiveGlassRoadBoss(captainUser)).toMatchObject({
      enemyId: 'story-elite-mirror-road-captain',
      completionQuestId: 'story-19-eclipse-scouts',
    });

    const priorUser = {
      ...captainUser,
      username: 'GlassRoadPrior',
      stats: { level: 20 },
      storyQuests: [
        ...captainUser.storyQuests!,
        { questId: 'story-19-eclipse-scouts', claimed: true, introSeen: true, completedAt: 2003 },
      ],
      activityLog: [{
        id: 'activity-battle-story-elite-mirror-road-captain-1',
        type: 'battle',
        description: 'enemy:story-elite-mirror-road-captain',
      }],
    } as unknown as User;

    expect(getActiveGlassRoadBoss(priorUser)).toMatchObject({
      enemyId: 'story-boss-prior-moon-voss',
      bossId: 'prior-moon-voss',
    });
    expect(getNpcEnemiesForUser(priorUser, Date.parse('2026-08-09T12:00:00Z'))
      .find(enemy => enemy.id === 'story-boss-prior-moon-voss')).toMatchObject({
      level: 20,
      storyLabel: 'Glass Road Capstone',
    });
  });
});

describe('Candle Key and Lady in Glass story encounters', () => {
  it('spawns Ser Kael then Key-Saint Ardan for the Candle Key chapter', () => {
    const kaelUser = {
      username: 'CandleKeyKael',
      stats: { level: 23 },
      storyQuests: [
        ...claimedThrough('story-15-broken-crown'),
        { questId: 'story-16-mirror-council', claimed: true },
        { questId: 'story-17-moonwell-contract', claimed: true },
        { questId: 'story-18-blackwater-gate', claimed: true },
        { questId: 'story-19-eclipse-scouts', claimed: true },
        { questId: 'story-20-first-dungeon-oath', claimed: true },
        { questId: 'story-20-glass-sealed', claimed: true },
        { questId: 'story-21-quarry-ledger', claimed: true },
        { questId: 'story-22-eclipse-hold', claimed: true },
      ],
      activityLog: [],
    } as unknown as User;

    expect(getActiveCandleKeyBoss(kaelUser)).toMatchObject({
      enemyId: 'story-elite-ser-kael-duskplate',
      bossId: 'ser-kael-duskplate',
    });

    const ardanUser = {
      ...kaelUser,
      username: 'CandleKeyArdan',
      stats: { level: 25 },
      storyQuests: [
        ...kaelUser.storyQuests!,
        { questId: 'story-23-iron-chorus', claimed: true },
        { questId: 'story-24-candle-key', claimed: true },
      ],
      activityLog: [{
        id: 'activity-battle-story-elite-ser-kael-duskplate-1',
        type: 'battle',
        description: 'enemy:story-elite-ser-kael-duskplate',
      }],
    } as unknown as User;

    expect(getActiveCandleKeyBoss(ardanUser)).toMatchObject({
      enemyId: 'story-boss-key-saint-ardan',
      bossId: 'key-saint-ardan',
    });
  });

  it('spawns Scarlet Matron then Lady Mirror-Veyra for the finale chapter', () => {
    const matronUser = {
      username: 'LadyMatron',
      stats: { level: 28 },
      storyQuests: [
        { questId: 'story-25-key-sealed', claimed: true },
        { questId: 'story-26-deep-dungeon', claimed: true },
        { questId: 'story-27-mirror-envoy', claimed: true },
      ],
      activityLog: [],
    } as unknown as User;

    expect(getActiveLadyInGlassBoss(matronUser)).toMatchObject({
      enemyId: 'story-elite-scarlet-matron',
      bossId: 'scarlet-matron-yvane',
    });

    const ladyUser = {
      ...matronUser,
      username: 'LadyVeyra',
      stats: { level: 30 },
      storyQuests: [
        ...matronUser.storyQuests!,
        { questId: 'story-28-eclipse-field', claimed: true },
        { questId: 'story-29-high-war', claimed: true },
      ],
      activityLog: [{
        id: 'activity-battle-story-elite-scarlet-matron-1',
        type: 'battle',
        description: 'enemy:story-elite-scarlet-matron',
      }],
    } as unknown as User;

    expect(getActiveLadyInGlassBoss(ladyUser)).toMatchObject({
      enemyId: 'story-boss-lady-mirror-veyra',
      bossId: 'lady-mirror-veyra',
    });
    expect(getNpcEnemiesForUser(ladyUser, Date.parse('2026-08-09T12:00:00Z'))
      .find(enemy => enemy.id === 'story-boss-lady-mirror-veyra')).toMatchObject({
      level: 30,
      storyLabel: 'Lady In Glass Capstone',
    });
  });
});
