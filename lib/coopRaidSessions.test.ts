import { describe, expect, it } from 'vitest';
import type { MinionStack, PartyState, User } from './auth';
import {
  COOP_BOSS_CYCLE_MS,
  applySynchronizedBattleAction,
  getActiveCoopBosses,
  type SynchronizedBattleAction,
} from './battle';
import {
  abandonCoopRaidSession,
  applyCoopRaidAction,
  confirmCoopRaidFormation,
  createCoopRaidSession,
  getCoopRaidReward,
  markCoopRaidClaimed,
  normalizeCoopRaidSessions,
  type CoopRaidSession,
} from './coopRaidSessions';

const NOW = 3 * COOP_BOSS_CYCLE_MS + 10_000;

function makeMinions(prefix: string, count = 6): MinionStack[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    templateId: index % 2 === 0 ? 'knight-squire' : 'priest-acolyte',
    quantity: 1,
    acquiredAt: NOW - index,
    fielded: true,
  }));
}

function makeUser(username: string, model: number, morale: number): User {
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
      morale,
      spellPower: 10,
      health: 120,
      maxHealth: 120,
      level: 5,
      unallocatedPoints: 0,
      attack: 10,
      defense: 8,
      speed: morale,
    },
    traveling: null,
    jobQueue: [],
    selectedModel: model,
    knownSpellIds: ['arcane-bolt', 'healing-light', 'fireball', 'frost-lance'],
    equippedSpellIds: ['arcane-bolt', 'healing-light', 'fireball', 'frost-lance'],
  };
}

function makeSession(): CoopRaidSession {
  const host = makeUser('BlackBanner', 1, 14);
  const ally = makeUser('MoonGuard', 2, 8);
  const party: PartyState = {
    leaderUsername: host.username,
    memberUsernames: [host.username, ally.username],
    invitedUsernames: [],
    updatedAt: NOW - 1_000,
  };
  const boss = getActiveCoopBosses(host, NOW)[0];
  const result = createCoopRaidSession(party, host, ally, boss, NOW);
  if (!result.session) throw new Error(result.error || 'Expected a co-op raid session.');
  return result.session;
}

function makeActiveSession(): CoopRaidSession {
  const created = makeSession();
  const hostReady = confirmCoopRaidFormation(
    created,
    created.hostUsername,
    created.hostFormation.placements,
    created.hostFormation.equippedSpellIds,
    created.version,
    NOW + 1_000,
  ).session!;
  return confirmCoopRaidFormation(
    hostReady,
    hostReady.allyUsername,
    hostReady.allyFormation.placements,
    hostReady.allyFormation.equippedSpellIds,
    hostReady.version,
    NOW + 2_000,
  ).session!;
}

function makeWaitAction(
  session: CoopRaidSession,
  id: string,
  actorUsername: string,
  unitId: string,
): SynchronizedBattleAction {
  return {
    id,
    type: 'wait',
    actorUsername,
    expectedRevision: session.combatSnapshot?.revision || 0,
    unitId,
    createdAt: NOW + 3_000,
  };
}

describe('co-op raid session lifecycle', () => {
  it('captures the fielded roster, limits initial placement, and requires two eligible profiles', () => {
    const session = makeSession();
    expect(session.phase).toBe('formation');
    expect(session.schemaVersion).toBe(1);
    expect(session.hostSnapshot.minions).toHaveLength(6);
    expect(session.allySnapshot.minions).toHaveLength(6);
    expect(Object.keys(session.hostFormation.placements)).toHaveLength(6);
    expect(Object.keys(session.allyFormation.placements)).toHaveLength(6);

    const lowLevelAlly = makeUser('NewBanner', 3, 4);
    lowLevelAlly.stats.level = 4;
    const rejected = createCoopRaidSession(
      {
        leaderUsername: session.hostUsername,
        memberUsernames: [session.hostUsername, lowLevelAlly.username],
        invitedUsernames: [],
        updatedAt: NOW,
      },
      makeUser(session.hostUsername, 1, 14),
      lowLevelAlly,
      session.bossSnapshot,
      NOW,
    );
    expect(rejected.success).toBe(false);
    expect(rejected.error).toContain('level 5');
  });

  it('tracks readiness independently and rejects stale formation revisions', () => {
    const created = makeSession();
    const hostReady = confirmCoopRaidFormation(
      created,
      created.hostUsername,
      created.hostFormation.placements,
      created.hostFormation.equippedSpellIds,
      created.version,
      NOW + 1_000,
    );
    expect(hostReady.session?.phase).toBe('formation');
    expect(hostReady.session?.hostFormation.confirmedAt).toBe(NOW + 1_000);
    expect(hostReady.session?.allyFormation.confirmedAt).toBeUndefined();

    const stale = confirmCoopRaidFormation(
      hostReady.session!,
      created.allyUsername,
      created.allyFormation.placements,
      created.allyFormation.equippedSpellIds,
      created.version,
      NOW + 2_000,
    );
    expect(stale.success).toBe(false);
    expect(stale.error).toContain('Refresh');

    const allyReady = confirmCoopRaidFormation(
      hostReady.session!,
      created.allyUsername,
      created.allyFormation.placements,
      created.allyFormation.equippedSpellIds,
      hostReady.session!.version,
      NOW + 2_000,
    );
    expect(allyReady.session?.phase).toBe('active');
    expect(allyReady.session?.combatSnapshot).toBeDefined();
    expect(allyReady.session?.combatSnapshot?.units
      .filter(unit => unit.ownerUsername === created.hostUsername && unit.kind === 'minion')
      .every(unit => unit.y <= 3)).toBe(true);
    expect(allyReady.session?.combatSnapshot?.units
      .filter(unit => unit.ownerUsername === created.allyUsername && unit.kind === 'minion')
      .every(unit => unit.y >= 5)).toBe(true);
  });

  it('enforces active-unit ownership and records synchronized actions once', () => {
    const active = makeActiveSession();
    const hostUnit = active.combatSnapshot!.units.find(unit => unit.ownerUsername === active.hostUsername)!;
    const hostTurn: CoopRaidSession = {
      ...active,
      combatSnapshot: { ...active.combatSnapshot!, activeUnitId: hostUnit.id },
    };
    const wrongOwner = applyCoopRaidAction(
      hostTurn,
      makeWaitAction(hostTurn, 'wrong-owner', active.allyUsername, hostUnit.id),
      hostTurn.version,
      NOW + 3_000,
    );
    expect(wrongOwner.success).toBe(false);
    expect(wrongOwner.error).toContain(active.hostUsername);

    const action = makeWaitAction(hostTurn, 'host-wait', active.hostUsername, hostUnit.id);
    const accepted = applyCoopRaidAction(hostTurn, action, hostTurn.version, NOW + 3_000);
    expect(accepted.success).toBe(true);
    expect(accepted.session?.version).toBe(hostTurn.version + 1);
    expect(accepted.session?.combatSnapshot?.processedActionIds).toContain(action.id);

    const duplicate = applyCoopRaidAction(
      accepted.session!,
      action,
      accepted.session!.version,
      NOW + 3_100,
    );
    expect(duplicate).toMatchObject({ success: true, duplicate: true });
    expect(duplicate.session?.version).toBe(accepted.session?.version);
  });

  it('lets either human participant advance an AI turn through the shared revision', () => {
    const active = makeActiveSession();
    const enemyUnit = active.combatSnapshot!.units.find(unit => unit.side === 'enemy')!;
    const enemyTurn: CoopRaidSession = {
      ...active,
      combatSnapshot: { ...active.combatSnapshot!, activeUnitId: enemyUnit.id },
    };
    const directResult = applySynchronizedBattleAction(enemyTurn.combatSnapshot!, {
      id: 'direct-ai-turn',
      type: 'ai-turn',
      actorUsername: active.allyUsername,
      expectedRevision: enemyTurn.combatSnapshot!.revision || 0,
      unitId: enemyUnit.id,
      createdAt: NOW + 3_000,
    }, NOW + 3_000);
    expect(directResult.success).toBe(true);

    const result = applyCoopRaidAction(enemyTurn, {
      id: 'session-ai-turn',
      type: 'ai-turn',
      actorUsername: active.hostUsername,
      expectedRevision: enemyTurn.combatSnapshot!.revision || 0,
      unitId: enemyUnit.id,
      createdAt: NOW + 3_000,
    }, enemyTurn.version, NOW + 3_000);
    expect(result.success).toBe(true);
    expect(result.session?.combatSnapshot?.revision).toBe((enemyTurn.combatSnapshot!.revision || 0) + 1);
  });

  it('turns a real final-phase kill into a completed victory and settles each claim once', () => {
    const active = makeActiveSession();
    const caster = active.combatSnapshot!.units.find(unit => (
      unit.ownerUsername === active.hostUsername && unit.kind === 'commander'
    ))!;
    const boss = active.combatSnapshot!.units.find(unit => (
      unit.side === 'enemy' && unit.kind === 'commander'
    ))!;
    const finalPhase: CoopRaidSession = {
      ...active,
      combatSnapshot: {
        ...active.combatSnapshot!,
        activeUnitId: caster.id,
        bossPhase: 4,
        mana: { ...active.combatSnapshot!.mana, player: 12 },
        units: active.combatSnapshot!.units.map(unit => {
          if (unit.id === boss.id) return { ...unit, currentHealth: 1 };
          if (unit.side === 'enemy') return { ...unit, currentHealth: 0 };
          return unit;
        }),
      },
    };
    const completed = applyCoopRaidAction(finalPhase, {
      id: 'final-phase-spell',
      type: 'cast-spell',
      actorUsername: finalPhase.hostUsername,
      expectedRevision: finalPhase.combatSnapshot!.revision || 0,
      unitId: caster.id,
      spellId: 'arcane-bolt',
      targetId: boss.id,
      createdAt: NOW + 4_000,
    }, finalPhase.version, NOW + 4_000);
    expect(completed.session?.phase).toBe('completed');
    expect(completed.session?.result?.outcome).toBe('victory');

    const hostReward = getCoopRaidReward(completed.session!, completed.session!.hostUsername);
    expect(getCoopRaidReward(completed.session!, completed.session!.hostUsername)).toEqual(hostReward);
    expect(hostReward.gold).toBeGreaterThan(0);
    expect(hostReward.rareGems).toBeGreaterThanOrEqual(2);

    const hostClaim = markCoopRaidClaimed(
      completed.session!,
      completed.session!.hostUsername,
      completed.session!.version,
      'Host Relic',
      NOW + 5_000,
    );
    expect(hostClaim.session?.result?.claimReceipts).toHaveLength(1);
    const duplicate = markCoopRaidClaimed(
      hostClaim.session!,
      completed.session!.hostUsername,
      hostClaim.session!.version,
      'Host Relic',
      NOW + 5_100,
    );
    expect(duplicate).toMatchObject({ success: true, duplicate: true });

    const allyClaim = markCoopRaidClaimed(
      hostClaim.session!,
      completed.session!.allyUsername,
      hostClaim.session!.version,
      'Ally Relic',
      NOW + 6_000,
    );
    expect(allyClaim.session?.result?.claimReceipts).toHaveLength(2);
  });

  it('supports shared abandon results and expires uncompleted sessions on reload', () => {
    const formation = makeSession();
    const abandonedFormation = abandonCoopRaidSession(
      formation,
      formation.allyUsername,
      formation.version,
      NOW + 1_000,
    );
    expect(abandonedFormation.session?.phase).toBe('abandoned');

    const active = makeActiveSession();
    const abandonedBattle = abandonCoopRaidSession(
      active,
      active.hostUsername,
      active.version,
      NOW + 3_000,
    );
    expect(abandonedBattle.session?.phase).toBe('completed');
    expect(abandonedBattle.session?.result?.outcome).toBe('abandoned');

    const normalized = normalizeCoopRaidSessions([formation], formation.expiresAt + 1);
    expect(normalized[0].phase).toBe('expired');
  });
});
