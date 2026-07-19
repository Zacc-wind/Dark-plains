import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptPartyInvite,
  getCurrentUser,
  getIncomingSocialRequests,
  invitePlayerToParty,
  login,
  register,
  updateCurrentUser,
} from './auth';
import { COOP_BOSS_CYCLE_MS, getActiveCoopBosses } from './battle';
import {
  ensureCurrentCoopRaidSession,
  confirmCurrentCoopRaidFormation,
  getCurrentCoopRaidSession,
  saveCoopRaidSession,
} from './coopRaidClient';
import { getCoopRaidReward, type CoopRaidSession } from './coopRaidSessions';

const NOW = 5 * COOP_BOSS_CYCLE_MS + 20_000;

class MemoryLocalStorage {
  private readonly values = new Map<string, string>();

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = new MemoryLocalStorage();

function prepareCurrentCommander(prefix: string): void {
  const user = getCurrentUser();
  if (!user) throw new Error('Expected a logged-in commander.');
  updateCurrentUser({
    stats: { ...user.stats, level: 5 },
    minions: [{
      id: `${prefix}-squire`,
      templateId: 'knight-squire',
      quantity: 1,
      acquiredAt: NOW - 1_000,
      fielded: true,
    }],
  });
}

function prepareDuo(): void {
  expect(register('RaidLeader', 'test-password').success).toBe(true);
  expect(login('RaidLeader', 'test-password').success).toBe(true);
  prepareCurrentCommander('leader');
  expect(register('RaidAlly', 'test-password').success).toBe(true);
  expect(login('RaidAlly', 'test-password').success).toBe(true);
  prepareCurrentCommander('ally');

  expect(login('RaidLeader', 'test-password').success).toBe(true);
  expect(invitePlayerToParty('RaidAlly')).toMatchObject({ success: true });
  expect(login('RaidAlly', 'test-password').success).toBe(true);
  const invitation = getIncomingSocialRequests().find(request => request.kind === 'party');
  expect(invitation).toBeDefined();
  expect(acceptPartyInvite(invitation!.id)).toMatchObject({ success: true });
  expect(login('RaidLeader', 'test-password').success).toBe(true);
}

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn() });
  vi.stubGlobal('CustomEvent', class {
    constructor(public type: string, public init?: unknown) {}
  });
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe('co-op raid client persistence', () => {
  it('creates a party raid, recovers it after reload, and blocks a second victory claim', () => {
    prepareDuo();
    const current = getCurrentUser()!;
    const boss = getActiveCoopBosses(current, NOW)[0];
    const created = ensureCurrentCoopRaidSession(boss.id, NOW);
    expect(created.success).toBe(true);
    expect(created.duplicate).not.toBe(true);
    expect(getCurrentCoopRaidSession(current.username, NOW)?.id).toBe(created.session?.id);
    expect(confirmCurrentCoopRaidFormation(
      created.session!.id,
      created.session!.allyUsername,
      created.session!.allyFormation.placements,
      created.session!.allyFormation.equippedSpellIds,
      created.session!.version,
      NOW + 500,
    )).toMatchObject({
      success: false,
      error: 'Raid commands must come from the current account.',
    });

    const reward = getCoopRaidReward(created.session!, current.username);
    const completed: CoopRaidSession = {
      ...created.session!,
      version: created.session!.version + 1,
      phase: 'completed',
      updatedAt: NOW + 1_000,
      result: {
        outcome: 'victory',
        completedAt: NOW + 1_000,
        finalBattleRevision: 20,
        claimReceipts: [{ username: current.username, claimedAt: NOW + 2_000, reward }],
      },
    };
    saveCoopRaidSession(completed, NOW + 2_000);

    expect(getCurrentCoopRaidSession(current.username, NOW + 2_000)).toBeUndefined();
    expect(ensureCurrentCoopRaidSession(boss.id, NOW + 2_000)).toMatchObject({
      success: false,
      error: 'You already cleared and claimed this incursion.',
    });
  });

  it('allows the leader to retry after both defeat reports are closed', () => {
    prepareDuo();
    const current = getCurrentUser()!;
    const boss = getActiveCoopBosses(current, NOW)[0];
    const created = ensureCurrentCoopRaidSession(boss.id, NOW).session!;
    const emptyReward = { gold: 0, exp: 0, rareGems: 0, equipmentRarity: 'epic' as const };
    const defeated: CoopRaidSession = {
      ...created,
      version: created.version + 1,
      phase: 'completed',
      updatedAt: NOW + 1_000,
      result: {
        outcome: 'defeat',
        completedAt: NOW + 1_000,
        finalBattleRevision: 12,
        claimReceipts: [
          { username: created.hostUsername, claimedAt: NOW + 2_000, reward: emptyReward },
          { username: created.allyUsername, claimedAt: NOW + 2_000, reward: emptyReward },
        ],
      },
    };
    saveCoopRaidSession(defeated, NOW + 2_000);

    const retried = ensureCurrentCoopRaidSession(boss.id, NOW + 3_000);
    expect(retried.success).toBe(true);
    expect(retried.duplicate).not.toBe(true);
    expect(retried.session?.phase).toBe('formation');
    expect(retried.session?.createdAt).toBe(NOW + 3_000);
  });
});
