import { describe, expect, it } from 'vitest';
import type { User } from './auth';
import { getActiveUnit } from './battle';
import {
  applyPvpDuelAction,
  confirmPvpDuelFormation,
  createPvpDuelSession,
  forfeitPvpDuelSession,
  markPvpDuelRatingApplied,
  normalizePvpDuelSessions,
} from './pvpDuelSessions';

function makeUser(username: string, morale: number): User {
  return {
    username,
    password: 'must-not-enter-snapshot',
    gold: 500,
    exp: 0,
    x: 10,
    y: 10,
    inventory: [],
    equipment: [],
    equippedSlots: {},
    minions: [],
    activityLog: [],
    stats: {
      armyPower: 2,
      defensivePower: 2,
      morale,
      spellPower: 2,
      health: 100,
      maxHealth: 100,
      level: 5,
      unallocatedPoints: 0,
    },
    traveling: null,
    jobQueue: [],
    selectedModel: 1,
    knownSpellIds: ['arcane-bolt', 'ember-dart'],
    equippedSpellIds: ['arcane-bolt'],
  };
}

function createReadySession() {
  const created = createPvpDuelSession({
    id: 'challenge-1',
    challengerUsername: 'BlackBanner',
    targetUsername: 'MoonGuard',
    readyAt: 900,
    status: 'ready',
  }, makeUser('BlackBanner', 12), makeUser('MoonGuard', 4), 1_000);
  expect(created.success).toBe(true);
  if (!created.session) throw new Error('Expected duel session.');
  return created.session;
}

describe('PVP duel sessions', () => {
  it('captures combat-only profiles and starts after both formations confirm', () => {
    const session = createReadySession();
    expect(session.phase).toBe('formation');
    expect('password' in session.challengerSnapshot).toBe(false);
    expect(session.challengerSnapshot.knownSpellIds).toContain('ember-dart');
    expect(session.challengerSnapshot.equippedSpellIds).toHaveLength(4);
    expect(session.challengerSnapshot.equippedSpellIds[0]).toBe('arcane-bolt');

    const challengerReady = confirmPvpDuelFormation(
      session,
      'BlackBanner',
      session.challengerFormation.placements,
      ['ember-dart'],
      1,
      1_100,
    );
    expect(challengerReady.success).toBe(true);
    expect(challengerReady.session?.phase).toBe('formation');
    expect(challengerReady.session?.version).toBe(2);

    const duplicate = confirmPvpDuelFormation(
      challengerReady.session!,
      'BlackBanner',
      challengerReady.session!.challengerFormation.placements,
      ['ember-dart'],
      2,
      1_200,
    );
    expect(duplicate.success).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.session?.version).toBe(2);

    const defenderReady = confirmPvpDuelFormation(
      duplicate.session!,
      'MoonGuard',
      duplicate.session!.defenderFormation.placements,
      ['arcane-bolt'],
      2,
      1_300,
    );
    expect(defenderReady.success).toBe(true);
    expect(defenderReady.session?.phase).toBe('active');
    expect(defenderReady.session?.version).toBe(3);
    expect(defenderReady.session?.combatSnapshot?.mode).toBe('pvp');
  });

  it('routes revisioned actions through the shared battle snapshot', () => {
    const session = createReadySession();
    const firstReady = confirmPvpDuelFormation(
      session,
      'BlackBanner',
      session.challengerFormation.placements,
      ['arcane-bolt'],
      1,
      1_100,
    ).session!;
    const activeSession = confirmPvpDuelFormation(
      firstReady,
      'MoonGuard',
      firstReady.defenderFormation.placements,
      ['arcane-bolt'],
      2,
      1_200,
    ).session!;
    const activeUnit = getActiveUnit(activeSession.combatSnapshot!);

    const actionResult = applyPvpDuelAction(activeSession, {
      id: 'duel-action-1',
      type: 'wait',
      actorUsername: activeUnit?.ownerUsername || '',
      expectedRevision: 0,
      unitId: activeUnit?.id,
      createdAt: 1_300,
    }, 3, 1_300);
    expect(actionResult.success).toBe(true);
    expect(actionResult.session?.version).toBe(4);
    expect(actionResult.session?.combatSnapshot?.revision).toBe(1);

    const replay = applyPvpDuelAction(actionResult.session!, {
      id: 'duel-action-1',
      type: 'wait',
      actorUsername: activeUnit?.ownerUsername || '',
      expectedRevision: 0,
      unitId: activeUnit?.id,
      createdAt: 1_300,
    }, 4, 1_400);
    expect(replay.success).toBe(true);
    expect(replay.duplicate).toBe(true);
    expect(replay.session?.version).toBe(4);
  });

  it('finalizes forfeits and rating application idempotently', () => {
    const session = createReadySession();
    const forfeited = forfeitPvpDuelSession(session, 'MoonGuard', 1, 2_000);
    expect(forfeited.success).toBe(true);
    expect(forfeited.session?.phase).toBe('completed');
    expect(forfeited.session?.result).toMatchObject({
      winnerUsername: 'BlackBanner',
      loserUsername: 'MoonGuard',
      reason: 'forfeit',
      ratingApplied: false,
    });

    const applied = markPvpDuelRatingApplied(forfeited.session!, 2_100);
    expect(applied.success).toBe(true);
    expect(applied.session?.result?.ratingApplied).toBe(true);
    const duplicate = markPvpDuelRatingApplied(applied.session!, 2_200);
    expect(duplicate.success).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.session?.version).toBe(applied.session?.version);
  });

  it('normalizes reloads, expires abandoned sessions, and removes duplicate ids', () => {
    const session = createReadySession();
    const normalized = normalizePvpDuelSessions([
      { ...session, schemaVersion: 0, version: 0 },
      { ...session, updatedAt: 900 },
    ], session.expiresAt + 1);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].schemaVersion).toBe(1);
    expect(normalized[0].version).toBe(1);
    expect(normalized[0].phase).toBe('expired');
  });
});
