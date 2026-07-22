import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimCurrentMultiplayerChronicleRank,
  getCurrentUser,
  login,
  register,
  updateCurrentUser,
} from './auth';
import { normalizeMultiplayerChronicleState } from './multiplayerChronicle';

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
const NOW = Date.UTC(2026, 6, 21, 12, 0, 0);

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', { localStorage: storage });
});

describe('Chronicle authored unit rewards', () => {
  it('grants the exact milestone unit once and persists it in the roster', () => {
    expect(register('ChronicleRecruit', 'test-password').success).toBe(true);
    expect(login('ChronicleRecruit', 'test-password').success).toBe(true);
    updateCurrentUser({
      multiplayerChronicle: normalizeMultiplayerChronicleState({ renown: 250 }),
    });

    const beforeCount = getCurrentUser()!.minions.filter(minion => minion.templateId === 'crossbow').length;
    const first = claimCurrentMultiplayerChronicleRank(5, NOW);

    expect(first.success).toBe(true);
    expect(first.rewards?.minions?.map(minion => minion.templateId)).toEqual(['crossbow']);
    expect(getCurrentUser()!.minions.filter(minion => minion.templateId === 'crossbow')).toHaveLength(beforeCount + 1);

    expect(claimCurrentMultiplayerChronicleRank(5, NOW + 1).success).toBe(false);
    expect(getCurrentUser()!.minions.filter(minion => minion.templateId === 'crossbow')).toHaveLength(beforeCount + 1);
  });
});
