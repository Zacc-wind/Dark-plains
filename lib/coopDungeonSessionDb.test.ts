import { describe, expect, it } from 'vitest';
import type { MinionStack, PartyState, User } from './auth';
import {
  createCoopDungeonSession,
  startCoopDungeonChamber,
} from './coopDungeonSessions';
import {
  coopDungeonSessionFromDbRow,
  coopDungeonSessionToDbPayload,
} from './coopDungeonSessionDb';
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

function makeParty(): PartyState {
  return {
    leaderUsername: 'Alice',
    memberUsernames: ['Alice', 'Bob'],
    invitedUsernames: [],
    updatedAt: NOW,
  };
}

describe('coopDungeonSessionDb', () => {
  it('round-trips session payload fields including packed meta', () => {
    const created = createCoopDungeonSession(
      makeParty(),
      makeUser('Alice', 3),
      makeUser('Bob', 4),
      makeDungeon(),
      NOW,
    );
    expect(created.success).toBe(true);
    const session = {
      ...created.session!,
      version: 2,
    };

    const payload = coopDungeonSessionToDbPayload(session, 'host-id', 'ally-id');
    expect(payload.phase).toBe('lobby');
    expect(payload.dungeon_id).toBe('dungeon-test-0');
    expect(payload.version).toBe(2);
    expect(payload.party_id).toBeNull();
    expect(payload.seed).toBe(session.seed);
    expect(payload.current_chamber_index).toBe(0);
    expect(payload.chambers).toHaveLength(3);
    expect(payload.combat_snapshot).toBeNull();
    expect(payload.result).toMatchObject({
      __coopDungeonMeta: true,
      partyId: session.partyId,
      dungeonSnapshot: expect.objectContaining({ id: 'dungeon-test-0' }),
      hostSnapshot: expect.objectContaining({ username: 'Alice' }),
      allySnapshot: expect.objectContaining({ username: 'Bob' }),
    });

    const restored = coopDungeonSessionFromDbRow(
      {
        ...payload,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString(),
      },
      'Alice',
      'Bob',
      session.createdAt,
    );

    expect(restored.phase).toBe('lobby');
    expect(restored.seed).toBe(session.seed);
    expect(restored.partyId).toBe(session.partyId);
    expect(restored.hostUsername).toBe('Alice');
    expect(restored.allyUsername).toBe('Bob');
    expect(restored.dungeonId).toBe('dungeon-test-0');
    expect(restored.dungeonSnapshot.name).toBe('Ossuary Cellar');
    expect(restored.chambers).toHaveLength(3);
    expect(restored.combatSnapshot).toBeUndefined();
  });

  it('restores chamber combat and abandonedBy from packed result meta', () => {
    const created = createCoopDungeonSession(
      makeParty(),
      makeUser('Alice', 3),
      makeUser('Bob', 4),
      makeDungeon(),
      NOW,
    );
    expect(created.success).toBe(true);
    const started = startCoopDungeonChamber(created.session!, created.session!.version, NOW + 100);
    expect(started.success).toBe(true);
    const session = {
      ...started.session!,
      phase: 'abandoned' as const,
      abandonedBy: 'Alice',
      combatSnapshot: undefined,
      chamberEnemy: undefined,
    };

    const payload = coopDungeonSessionToDbPayload(session, 'host-id', 'ally-id');
    expect(payload.phase).toBe('abandoned');
    expect(payload.result).toMatchObject({ abandonedBy: 'Alice' });

    const restored = coopDungeonSessionFromDbRow(
      {
        ...payload,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString(),
      },
      'Alice',
      'Bob',
      session.createdAt,
    );

    expect(restored.phase).toBe('abandoned');
    expect(restored.abandonedBy).toBe('Alice');
    expect(restored.combatSnapshot).toBeUndefined();
  });

  it('preserves combat_snapshot through serialize/normalize', () => {
    const created = createCoopDungeonSession(
      makeParty(),
      makeUser('Alice', 3),
      makeUser('Bob', 4),
      makeDungeon(),
      NOW,
    );
    const started = startCoopDungeonChamber(created.session!, created.session!.version, NOW + 50);
    expect(started.success).toBe(true);
    const session = started.session!;
    expect(session.combatSnapshot).toBeTruthy();

    const payload = coopDungeonSessionToDbPayload(session, 'host-id', 'ally-id');
    expect(payload.phase).toBe('chamber');
    expect(payload.combat_snapshot).toMatchObject({
      mode: 'coop',
      revision: session.combatSnapshot?.revision,
    });
    expect(payload.result).toMatchObject({
      chamberEnemy: expect.objectContaining({ id: session.chamberEnemy?.id }),
    });

    const restored = coopDungeonSessionFromDbRow(
      {
        ...payload,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString(),
      },
      'Alice',
      'Bob',
      session.createdAt,
    );

    expect(restored.phase).toBe('chamber');
    expect(restored.combatSnapshot?.revision).toBe(session.combatSnapshot?.revision);
    expect(restored.chamberEnemy?.id).toBe(session.chamberEnemy?.id);
    expect(restored.currentChamberIndex).toBe(0);
  });
});
