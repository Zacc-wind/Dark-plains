import { describe, expect, it } from 'vitest';
import type { MinionStack, PartyState, User } from './auth';
import {
  abandonCoopDungeonSession,
  advanceChamber,
  buildCoopDungeonChambers,
  createCoopDungeonSession,
  startCoopDungeonChamber,
  type CoopDungeonSession,
} from './coopDungeonSessions';
import type { WorldDungeon } from './worldEvents';

const NOW = 1_700_000_000_000;

function makeMinions(prefix: string, count = 4): MinionStack[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    templateId: index % 2 === 0 ? 'knight-squire' : 'priest-acolyte',
    quantity: 1,
    acquiredAt: NOW - index,
    fielded: true,
  }));
}

function makeUser(username: string, model: number, level = 5): User {
  return {
    username,
    password: 'test-password',
    gold: 0,
    exp: 0,
    x: 10,
    y: 10,
    inventory: [],
    equipment: [],
    equippedSlots: {},
    minions: makeMinions(username.toLowerCase()),
    activityLog: [],
    stats: {
      armyPower: 8,
      defensivePower: 7,
      morale: 10,
      spellPower: 10,
      health: 120,
      maxHealth: 120,
      level,
      unallocatedPoints: 0,
      attack: 10,
      defense: 8,
      speed: 10,
    },
    traveling: null,
    jobQueue: [],
    selectedModel: model,
    knownSpellIds: ['arcane-bolt', 'healing-light'],
    equippedSpellIds: ['arcane-bolt', 'healing-light'],
  };
}

function makeDungeon(): WorldDungeon {
  return {
    id: 'dungeon-test-0',
    templateId: 'ossuary-cellar',
    name: 'Ossuary Cellar',
    bossId: 'mother-cindervein',
    bossName: 'Ossuary Candlekeeper',
    bossSubtitle: 'Bone-lit crypt boss',
    bossStory: 'Candle vows keep the dead obedient.',
    bossIntro: 'The cellar door seals behind you.',
    bossArtworkPath: '/assets/bosses/mother-cindervein.png',
    bossModelNumber: 5,
    bossPersonality: 'defensive',
    bossMinionTemplates: ['darkpriest', 'witchdoc', 'bell', 'knight-squire'],
    x: 18,
    y: 17,
    level: 6,
    tier: 1,
    requiredPlayerLevel: 2,
    expiresAt: NOW + 3 * 60 * 60 * 1000,
    description: 'A cellar under collapsed chapel stones.',
  };
}

function makeSession(): CoopDungeonSession {
  const host = makeUser('RouteHost', 1);
  const ally = makeUser('RouteAlly', 2);
  const party: PartyState = {
    leaderUsername: host.username,
    memberUsernames: [host.username, ally.username],
    invitedUsernames: [],
    updatedAt: NOW - 1_000,
  };
  const result = createCoopDungeonSession(party, host, ally, makeDungeon(), NOW);
  if (!result.session) throw new Error(result.error || 'Expected a coop dungeon session.');
  return result.session;
}

describe('coop dungeon session foundation', () => {
  it('creates a shared-seed lobby with a 3-chamber dungeon route stub', () => {
    const dungeon = makeDungeon();
    const chambers = buildCoopDungeonChambers(dungeon);
    expect(chambers).toHaveLength(3);
    expect(chambers[0].label).toContain('Threshold');
    expect(chambers[2].label).toContain(dungeon.bossName);

    const session = makeSession();
    expect(session.phase).toBe('lobby');
    expect(session.dungeonId).toBe(dungeon.id);
    expect(session.seed).toContain(dungeon.id);
    expect(session.chambers).toHaveLength(3);
    expect(session.chambers.every(chamber => !chamber.cleared)).toBe(true);
    expect(session.currentChamberIndex).toBe(0);
    expect(session.hostUsername).toBe('RouteHost');
    expect(session.allyUsername).toBe('RouteAlly');
    expect(session.version).toBe(1);
  });

  it('starts a chamber battle, then advances through all three chambers to complete', () => {
    let session = makeSession();

    const started = startCoopDungeonChamber(session, session.version, NOW + 1_000);
    expect(started.success).toBe(true);
    session = started.session!;
    expect(session.phase).toBe('chamber');
    expect(session.combatSnapshot?.mode).toBe('coop');
    expect(session.chamberEnemy?.name).toContain('Scouts');

    const first = advanceChamber(session, session.version, NOW + 2_000);
    expect(first.success).toBe(true);
    session = first.session!;
    expect(session.chambers[0].cleared).toBe(true);
    expect(session.currentChamberIndex).toBe(1);
    expect(session.phase).toBe('lobby');
    expect(session.combatSnapshot).toBeUndefined();

    const midStart = startCoopDungeonChamber(session, session.version, NOW + 3_000);
    session = midStart.session!;
    expect(session.chamberEnemy?.name).toContain('Wardens');
    session = advanceChamber(session, session.version, NOW + 4_000).session!;
    expect(session.currentChamberIndex).toBe(2);

    const bossStart = startCoopDungeonChamber(session, session.version, NOW + 5_000);
    session = bossStart.session!;
    expect(session.chamberEnemy?.name).toBe('Ossuary Candlekeeper');
    session = advanceChamber(session, session.version, NOW + 6_000).session!;
    expect(session.phase).toBe('complete');
    expect(session.chambers.every(chamber => chamber.cleared)).toBe(true);
  });

  it('abandons an open route and rejects advance after abandon', () => {
    const session = makeSession();
    const abandoned = abandonCoopDungeonSession(
      session,
      session.hostUsername,
      session.version,
      NOW + 500,
    );
    expect(abandoned.success).toBe(true);
    expect(abandoned.session?.phase).toBe('abandoned');
    expect(abandoned.session?.abandonedBy).toBe(session.hostUsername);

    const advanced = advanceChamber(
      abandoned.session!,
      abandoned.session!.version,
      NOW + 1_000,
    );
    expect(advanced.success).toBe(false);
  });

  it('rejects create when party size is wrong or leader is not host', () => {
    const host = makeUser('RouteHost', 1);
    const ally = makeUser('RouteAlly', 2);
    const outsider = makeUser('Outsider', 3);
    const party: PartyState = {
      leaderUsername: ally.username,
      memberUsernames: [host.username, ally.username],
      invitedUsernames: [],
      updatedAt: NOW,
    };
    expect(createCoopDungeonSession(party, host, ally, makeDungeon(), NOW)).toMatchObject({
      success: false,
    });

    const trio: PartyState = {
      leaderUsername: host.username,
      memberUsernames: [host.username, ally.username, outsider.username],
      invitedUsernames: [],
      updatedAt: NOW,
    };
    expect(createCoopDungeonSession(trio, host, ally, makeDungeon(), NOW)).toMatchObject({
      success: false,
    });
  });
});
