import { describe, expect, it } from 'vitest';
import type { User } from './auth';
import {
  applySynchronizedBattleAction,
  canUserControlBattleUnit,
  createPvpBattleState,
  getActiveUnit,
  shouldRunBattleAi,
  type SynchronizedBattleAction,
} from './battle';

function makeUser(username: string, speed: number, selectedModel: number): User {
  return {
    username,
    password: 'test',
    gold: 0,
    exp: 0,
    x: 10,
    y: 10,
    inventory: [],
    equipment: [],
    equippedSlots: {},
    minions: [],
    activityLog: [],
    stats: {
      armyPower: 1,
      defensivePower: 1,
      morale: speed,
      spellPower: 1,
      health: 100,
      maxHealth: 100,
      level: 5,
      unallocatedPoints: 0,
      attack: 8,
      defense: 6,
      speed,
    },
    traveling: null,
    jobQueue: [],
    selectedModel,
    knownSpellIds: ['arcane-bolt'],
    equippedSpellIds: ['arcane-bolt'],
  };
}

function makeWaitAction(
  id: string,
  actorUsername: string,
  expectedRevision: number,
  unitId: string,
): SynchronizedBattleAction {
  return {
    id,
    type: 'wait',
    actorUsername,
    expectedRevision,
    unitId,
    createdAt: 1_000,
  };
}

describe('multiplayer combat ownership', () => {
  it('creates a two-human duel snapshot with explicit ownership and no defender AI', () => {
    const challenger = makeUser('BlackBanner', 12, 1);
    const defender = makeUser('MoonGuard', 4, 2);
    const battle = createPvpBattleState(challenger, defender, {
      battleId: 'duel-test',
      now: 1_000,
    });

    expect(battle.mode).toBe('pvp');
    expect(battle.revision).toBe(0);
    expect(battle.participants).toEqual([
      { username: 'BlackBanner', side: 'player', teamId: 'challenger', controller: 'human' },
      { username: 'MoonGuard', side: 'enemy', teamId: 'defender', controller: 'human' },
    ]);
    expect(battle.units.every(unit => Boolean(unit.ownerUsername && unit.teamId))).toBe(true);

    const defenderCommander = battle.units.find(unit => unit.side === 'enemy' && unit.kind === 'commander');
    expect(defenderCommander?.ownerUsername).toBe('MoonGuard');
    expect(canUserControlBattleUnit(battle, 'MoonGuard', defenderCommander)).toBe(true);

    const defenderTurn = { ...battle, activeUnitId: defenderCommander?.id || '' };
    expect(shouldRunBattleAi(defenderTurn)).toBe(false);
  });

  it('accepts only the active owner and records an action exactly once', () => {
    const battle = createPvpBattleState(
      makeUser('BlackBanner', 12, 1),
      makeUser('MoonGuard', 4, 2),
      { battleId: 'duel-owner', now: 1_000 },
    );
    const activeUnit = getActiveUnit(battle);
    expect(activeUnit?.ownerUsername).toBe('BlackBanner');

    const rejected = applySynchronizedBattleAction(
      battle,
      makeWaitAction('action-wrong-owner', 'MoonGuard', 0, activeUnit?.id || ''),
      1_200,
    );
    expect(rejected.success).toBe(false);
    expect(rejected.error).toContain("BlackBanner's turn");
    expect(rejected.state).toBe(battle);

    const action = makeWaitAction('action-1', 'BlackBanner', 0, activeUnit?.id || '');
    const accepted = applySynchronizedBattleAction(battle, action, 1_200);
    expect(accepted.success).toBe(true);
    expect(accepted.state.revision).toBe(1);
    expect(accepted.state.processedActionIds).toContain('action-1');
    expect(accepted.state.activeUnitId).not.toBe(activeUnit?.id);

    const duplicate = applySynchronizedBattleAction(accepted.state, action, 1_300);
    expect(duplicate.success).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.state.revision).toBe(1);
  });

  it('rejects stale revisions and permits either participant to trigger an expired auto-pass', () => {
    const battle = createPvpBattleState(
      makeUser('BlackBanner', 12, 1),
      makeUser('MoonGuard', 4, 2),
      { battleId: 'duel-timeout', now: 1_000, turnTimeLimitMs: 15_000 },
    );
    const activeUnit = getActiveUnit(battle);
    const stale = applySynchronizedBattleAction(
      { ...battle, revision: 2 },
      makeWaitAction('action-stale', 'BlackBanner', 1, activeUnit?.id || ''),
      2_000,
    );
    expect(stale.success).toBe(false);
    expect(stale.error).toContain('Refresh');

    const earlyTimeout = applySynchronizedBattleAction(battle, {
      id: 'timeout-early',
      type: 'timeout-pass',
      actorUsername: 'MoonGuard',
      expectedRevision: 0,
      createdAt: 2_000,
    }, 15_999);
    expect(earlyTimeout.success).toBe(false);

    const expiredTimeout = applySynchronizedBattleAction(battle, {
      id: 'timeout-expired',
      type: 'timeout-pass',
      actorUsername: 'MoonGuard',
      expectedRevision: 0,
      createdAt: 16_000,
    }, 16_000);
    expect(expiredTimeout.success).toBe(true);
    expect(expiredTimeout.state.revision).toBe(1);
    expect(expiredTimeout.state.activeUnitId).not.toBe(activeUnit?.id);
  });
});
