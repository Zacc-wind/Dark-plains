import { describe, expect, it } from 'vitest';
import type { User } from './auth';
import {
  COOP_BOSS_CYCLE_MS,
  COOP_BOSS_PHASES,
  COOP_PLAYER_FIELD_MINIONS,
  COOP_TURN_TIME_LIMIT_MS,
  applySynchronizedBattleAction,
  canUserControlBattleUnit,
  castBattleSpell,
  createCoopBattleState,
  createPvpBattleState,
  getActiveCoopBosses,
  getActiveUnit,
  getCappedBattleSpellDamage,
  getTurnOrder,
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

describe('co-op boss combat foundation', () => {
  it('creates a duo-owned 15x9 raid with five minion slots each and morale turn order', () => {
    const host = makeUser('BlackBanner', 14, 1);
    const ally = makeUser('MoonGuard', 8, 2);
    const enemy = getActiveCoopBosses(host, 10 * COOP_BOSS_CYCLE_MS + 1)[0];
    const stacks = Array.from({ length: 7 }, (_, index) => ({
      id: `field-${index}`,
      templateId: index % 2 === 0 ? 'knight-squire' : 'priest-acolyte',
      quantity: 1,
      acquiredAt: 1,
    }));
    const battle = createCoopBattleState(host, ally, enemy, {
      battleId: 'coop-foundation',
      hostStacks: stacks.map(stack => ({ ...stack, id: `host-${stack.id}` })),
      allyStacks: stacks.map(stack => ({ ...stack, id: `ally-${stack.id}` })),
      now: 1_000,
    });

    expect(battle.mode).toBe('coop');
    expect(battle.boardWidth).toBe(15);
    expect(battle.boardHeight).toBe(9);
    expect(battle.turnTimeLimitMs).toBe(COOP_TURN_TIME_LIMIT_MS);
    expect(battle.bossPhase).toBe(1);
    expect(battle.bossPhaseCount).toBe(COOP_BOSS_PHASES);
    expect(battle.participants?.filter(participant => participant.controller === 'human')).toHaveLength(2);
    expect(battle.units.filter(unit => unit.ownerUsername === host.username && unit.kind === 'minion')).toHaveLength(COOP_PLAYER_FIELD_MINIONS);
    expect(battle.units.filter(unit => unit.ownerUsername === ally.username && unit.kind === 'minion')).toHaveLength(COOP_PLAYER_FIELD_MINIONS);
    expect(battle.units.filter(unit => unit.side === 'player').every(unit => unit.teamId === 'party' && Boolean(unit.ownerUsername))).toBe(true);
    expect(battle.activeUnitId).toBe(getTurnOrder(battle.units)[0].id);
  });

  it('rotates exactly two raid bosses every five hours', () => {
    const user = makeUser('BlackBanner', 10, 1);
    const now = 4 * COOP_BOSS_CYCLE_MS + 12_345;
    const bosses = getActiveCoopBosses(user, now);

    expect(bosses).toHaveLength(2);
    expect(new Set(bosses.map(boss => boss.id)).size).toBe(2);
    expect(bosses.every(boss => boss.spawnKind === 'coop-boss' && boss.minions.length === 8)).toBe(true);
    expect(bosses.every(boss => (boss.expiresAt || 0) - (boss.spawnedAt || 0) === COOP_BOSS_CYCLE_MS)).toBe(true);
  });

  it('caps player spell bursts and fully restores a raid boss through four phases', () => {
    const host = makeUser('BlackBanner', 14, 1);
    const ally = makeUser('MoonGuard', 8, 2);
    const enemy = getActiveCoopBosses(host, COOP_BOSS_CYCLE_MS + 1)[0];
    let battle = createCoopBattleState(host, ally, enemy, { battleId: 'coop-phases', now: 1_000 });
    const caster = battle.units.find(unit => unit.ownerUsername === host.username && unit.kind === 'commander');
    const boss = battle.units.find(unit => unit.side === 'enemy' && unit.kind === 'commander');

    expect(caster).toBeDefined();
    expect(boss).toBeDefined();
    expect(getCappedBattleSpellDamage(battle, caster!, boss!, 99_999)).toBe(Math.floor(boss!.maxHealth * 0.1));

    const startingAttack = boss!.attack;
    for (let expectedPhase = 2; expectedPhase <= COOP_BOSS_PHASES; expectedPhase += 1) {
      battle = {
        ...battle,
        activeUnitId: caster!.id,
        mana: { ...battle.mana, player: 12 },
        units: battle.units.map(unit => unit.id === boss!.id ? { ...unit, currentHealth: 1 } : unit),
      };
      battle = castBattleSpell(battle, 'arcane-bolt', boss!.id);
      const phasedBoss = battle.units.find(unit => unit.id === boss!.id)!;
      expect(battle.bossPhase).toBe(expectedPhase);
      expect(phasedBoss.currentHealth).toBe(phasedBoss.maxHealth);
    }

    expect(battle.units.find(unit => unit.id === boss!.id)!.attack).toBe(startingAttack + 6);
  });
});
