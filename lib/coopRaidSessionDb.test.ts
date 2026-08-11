import { describe, expect, it } from 'vitest';
import type { User } from './auth';
import { getActiveCoopBosses, COOP_BOSS_CYCLE_MS } from './battle';
import { createCoopRaidSession, confirmCoopRaidFormation, applyCoopRaidAction } from './coopRaidSessions';
import {
  coopRaidSessionFromDbRow,
  coopRaidSessionToDbPayload,
} from './coopRaidSessionDb';

const NOW = 5 * COOP_BOSS_CYCLE_MS + 20_000;

function mockUser(username: string, level = 5): User {
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
    minions: [{
      id: `${username}-squire`,
      templateId: 'knight-squire',
      quantity: 1,
      acquiredAt: NOW,
      fielded: true,
    }],
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

describe('coopRaidSessionDb', () => {
  it('round-trips session payload fields including meta', () => {
    const host = mockUser('Alice');
    const ally = mockUser('Bob');
    const boss = getActiveCoopBosses(host, NOW)[0];
    const created = createCoopRaidSession(
      {
        leaderUsername: 'Alice',
        memberUsernames: ['Alice', 'Bob'],
        invitedUsernames: [],
        updatedAt: NOW,
      },
      host,
      ally,
      boss,
      NOW,
    );
    expect(created.success).toBe(true);
    const session = {
      ...created.session!,
      version: 2,
      hostFormation: {
        ...created.session!.hostFormation,
        confirmedAt: NOW + 100,
      },
    };

    const payload = coopRaidSessionToDbPayload(session, 'host-id', 'ally-id');
    expect(payload.phase).toBe('formation');
    expect(payload.boss_id).toBe(boss.id);
    expect(payload.version).toBe(2);
    expect(payload.party_id).toBeNull();
    expect(payload.combat_snapshot).toMatchObject({
      __coopRaidMeta: true,
      seed: session.seed,
      partyId: session.partyId,
    });

    const restored = coopRaidSessionFromDbRow(
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
    expect(restored.partyId).toBe(session.partyId);
    expect(restored.hostFormation.confirmedAt).toBe(NOW + 100);
    expect(restored.hostUsername).toBe('Alice');
    expect(restored.allyUsername).toBe('Bob');
    expect(restored.bossId).toBe(boss.id);
    expect(restored.combatSnapshot).toBeUndefined();
  });

  it('restores completed result and abandonedBy from packed result meta', () => {
    const host = mockUser('Alice');
    const ally = mockUser('Bob');
    const boss = getActiveCoopBosses(host, NOW)[0];
    const created = createCoopRaidSession(
      {
        leaderUsername: 'Alice',
        memberUsernames: ['Alice', 'Bob'],
        invitedUsernames: [],
        updatedAt: NOW,
      },
      host,
      ally,
      boss,
      NOW,
    );
    const session = {
      ...created.session!,
      phase: 'completed' as const,
      abandonedBy: 'Alice',
      result: {
        outcome: 'abandoned' as const,
        completedAt: NOW + 500,
        finalBattleRevision: 3,
        claimReceipts: [],
      },
    };

    const payload = coopRaidSessionToDbPayload(session, 'host-id', 'ally-id');
    const restored = coopRaidSessionFromDbRow(
      {
        ...payload,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString(),
      },
      'Alice',
      'Bob',
      session.createdAt,
    );

    expect(restored.phase).toBe('completed');
    expect(restored.abandonedBy).toBe('Alice');
    expect(restored.result?.outcome).toBe('abandoned');
    expect(restored.result?.finalBattleRevision).toBe(3);
  });

  it('shapes coop_raid_actions payloads from applyCoopRaidAction combat actions', () => {
    const host = mockUser('Alice');
    const ally = mockUser('Bob');
    const boss = getActiveCoopBosses(host, NOW)[0];
    const created = createCoopRaidSession(
      {
        leaderUsername: 'Alice',
        memberUsernames: ['Alice', 'Bob'],
        invitedUsernames: [],
        updatedAt: NOW,
      },
      host,
      ally,
      boss,
      NOW,
    );
    expect(created.success).toBe(true);
    let session = created.session!;

    session = confirmCoopRaidFormation(
      session,
      'Alice',
      session.hostFormation.placements,
      session.hostFormation.equippedSpellIds,
      session.version,
      NOW + 100,
    ).session!;
    session = confirmCoopRaidFormation(
      session,
      'Bob',
      session.allyFormation.placements,
      session.allyFormation.equippedSpellIds,
      session.version,
      NOW + 200,
    ).session!;
    expect(session.phase).toBe('active');
    expect(session.combatSnapshot).toBeTruthy();

    const hostUnit = session.combatSnapshot!.units.find(unit => unit.ownerUsername === 'Alice')!;
    const hostTurn = {
      ...session,
      combatSnapshot: { ...session.combatSnapshot!, activeUnitId: hostUnit.id },
    };
    const action = {
      id: `action-${session.id}-1`,
      type: 'wait' as const,
      actorUsername: 'Alice',
      expectedRevision: hostTurn.combatSnapshot.revision || 0,
      unitId: hostUnit.id,
      createdAt: NOW + 300,
    };
    const applied = applyCoopRaidAction(hostTurn, action, hostTurn.version, NOW + 300);
    expect(applied.success).toBe(true);
    expect(applied.session?.version).toBe(hostTurn.version + 1);

    const actionRow = {
      session_id: session.id,
      action_id: action.id,
      actor_id: 'host-id',
      expected_revision: action.expectedRevision,
      payload: action,
    };
    expect(actionRow).toMatchObject({
      session_id: session.id,
      action_id: action.id,
      expected_revision: action.expectedRevision,
      payload: {
        id: action.id,
        type: 'wait',
        actorUsername: 'Alice',
        unitId: hostUnit.id,
      },
    });

    const dbPayload = coopRaidSessionToDbPayload(applied.session!, 'host-id', 'ally-id');
    expect(dbPayload.version).toBe(applied.session!.version);
    expect(dbPayload.combat_snapshot).toMatchObject({
      revision: applied.session!.combatSnapshot?.revision,
    });
  });
});
