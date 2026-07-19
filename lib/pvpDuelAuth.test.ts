import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUsers,
  recordPvpDuelOutcome,
  register,
} from './auth';

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

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', { localStorage: storage });
});

describe('PVP duel outcome persistence', () => {
  it('applies rating and genuine engagement receipts once per duel id', () => {
    expect(register('BlackBanner', 'test-password').success).toBe(true);
    expect(register('MoonGuard', 'test-password').success).toBe(true);

    const first = recordPvpDuelOutcome('BlackBanner', 'MoonGuard', 'duel-idempotent', 1_000);
    expect(first.success).toBe(true);
    expect(first.duplicate).not.toBe(true);

    const firstUsers = getUsers();
    const winner = firstUsers.find(user => user.username === 'BlackBanner');
    const loser = firstUsers.find(user => user.username === 'MoonGuard');
    expect(winner?.pvpRating?.wins).toBe(1);
    expect(loser?.pvpRating?.losses).toBe(1);
    expect(winner?.pvpRating?.processedDuelIds).toContain('duel-idempotent');
    expect(winner?.multiplayerEngagement?.events.filter(event => event.kind === 'pvp-completed')).toHaveLength(1);
    expect(loser?.multiplayerEngagement?.events.filter(event => event.kind === 'pvp-completed')).toHaveLength(1);

    const duplicate = recordPvpDuelOutcome('BlackBanner', 'MoonGuard', 'duel-idempotent', 2_000);
    expect(duplicate).toMatchObject({ success: true, duplicate: true });
    const reloadedUsers = getUsers();
    expect(reloadedUsers.find(user => user.username === 'BlackBanner')?.pvpRating?.wins).toBe(1);
    expect(reloadedUsers.find(user => user.username === 'MoonGuard')?.pvpRating?.losses).toBe(1);
  });
});
