import { describe, expect, it } from 'vitest';
import { createPvpDuelSession } from './pvpDuelSessions';
import {
  duelPhaseFromDb,
  duelPhaseToDb,
  pvpDuelSessionFromDbRow,
  pvpDuelSessionToDbPayload,
} from './pvpDuelSessionDb';
import type { User } from './auth';

function mockUser(username: string, level = 4): User {
  return {
    username,
    password: '',
    gold: 100,
    exp: 0,
    x: 10,
    y: 10,
    inventory: [],
    equipment: [],
    equippedSlots: {},
    minions: [],
    activityLog: [],
    stats: {
      level,
      armyPower: 4,
      defensivePower: 4,
      morale: 4,
      spellPower: 4,
      health: 40,
      maxHealth: 40,
      unallocatedPoints: 0,
    },
    selectedModel: 3,
    knownSpellIds: ['arcane-bolt', 'ember-dart'],
    equippedSpellIds: ['arcane-bolt', 'ember-dart'],
    traveling: null,
    jobQueue: [],
  };
}

describe('pvpDuelSessionDb', () => {
  it('maps cancelled to abandoned and back', () => {
    expect(duelPhaseToDb('cancelled')).toBe('abandoned');
    expect(duelPhaseFromDb('abandoned')).toBe('cancelled');
    expect(duelPhaseToDb('formation')).toBe('formation');
  });

  it('round-trips session payload fields including meta', () => {
    const created = createPvpDuelSession(
      {
        id: 'challenge-1',
        challengerUsername: 'Alice',
        targetUsername: 'Bob',
        status: 'ready',
        readyAt: 1_700_000_000_000,
      },
      mockUser('Alice'),
      mockUser('Bob'),
      1_700_000_000_000,
    );
    expect(created.success).toBe(true);
    const session = {
      ...created.session!,
      version: 2,
      challengerFormation: {
        ...created.session!.challengerFormation,
        confirmedAt: 1_700_000_000_100,
      },
    };

    const payload = pvpDuelSessionToDbPayload(session, 'challenger-id', 'target-id');
    expect(payload.phase).toBe('formation');
    expect(payload.challenge_id).toBe('challenge-1');
    expect(payload.version).toBe(2);
    expect(payload.combat_snapshot).toMatchObject({ __pvpDuelMeta: true, seed: session.seed });

    const restored = pvpDuelSessionFromDbRow(
      {
        ...payload,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString(),
      },
      'Alice',
      'Bob',
      session.createdAt,
    );

    expect(restored.phase).toBe('formation');
    expect(restored.seed).toBe(session.seed);
    expect(restored.challengerFormation.confirmedAt).toBe(1_700_000_000_100);
    expect(restored.challengerUsername).toBe('Alice');
    expect(restored.defenderUsername).toBe('Bob');
    expect(restored.combatSnapshot).toBeUndefined();
  });
});
