import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUsers,
  login,
  recordCoopRaidOutcome,
  register,
  updateCurrentUser,
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

describe('co-op raid reward persistence', () => {
  it('grants currency, gear, and genuine engagement receipts exactly once', () => {
    expect(register('RaidWinner', 'test-password').success).toBe(true);
    expect(login('RaidWinner', 'test-password').success).toBe(true);
    const registered = getUsers().find(user => user.username === 'RaidWinner')!;
    updateCurrentUser({ stats: { ...registered.stats, level: 5 } });
    const before = getUsers().find(user => user.username === 'RaidWinner')!;
    expect(before.stats.level).toBe(5);
    const reward = { gold: 240, exp: 20, rareGems: 3, equipmentRarity: 'epic' as const };

    const first = recordCoopRaidOutcome(
      before.username,
      'raid-idempotent',
      'The Ashen Prior',
      reward,
      1_000,
    );
    expect(first.success).toBe(true);
    expect(first.duplicate).not.toBe(true);

    const afterFirst = getUsers().find(user => user.username === before.username)!;
    expect(afterFirst.gold).toBe(before.gold + reward.gold);
    expect(afterFirst.exp).toBe(before.exp + reward.exp);
    expect(afterFirst.inventory.find(item => item.id === 'rare-gem')?.quantity).toBe(reward.rareGems);
    expect(afterFirst.equipment).toHaveLength(before.equipment.length + 1);
    expect(afterFirst.equipment.at(-1)?.rarity).toBe('rare');
    expect(afterFirst.multiplayerEngagement?.events.filter(event => event.kind === 'coop-completed')).toHaveLength(1);
    expect(afterFirst.multiplayerEngagement?.events.filter(event => event.kind === 'dungeon-cleared')).toHaveLength(1);
    expect(afterFirst.multiplayerEngagement?.events.filter(event => event.kind === 'battle-result-claimed')).toHaveLength(1);

    const duplicate = recordCoopRaidOutcome(
      before.username,
      'raid-idempotent',
      'The Ashen Prior',
      reward,
      2_000,
    );
    expect(duplicate).toMatchObject({ success: true, duplicate: true });

    const afterDuplicate = getUsers().find(user => user.username === before.username)!;
    expect(afterDuplicate.gold).toBe(afterFirst.gold);
    expect(afterDuplicate.exp).toBe(afterFirst.exp);
    expect(afterDuplicate.equipment).toHaveLength(afterFirst.equipment.length);
  });
});
