import { describe, expect, it } from 'vitest';
import { MAX_PLAYER_LEVEL } from '@/lib/auth';
import {
  PLAYER_SYNC_MAX_INVENTORY_ITEMS,
  shouldFallbackPlayerSyncToDirectWrite,
  validatePlayerSyncPayload,
} from './playerStateSync';

const authUserId = 'user-123';
const profileUsername = 'dark-ranger';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    userId: authUserId,
    player: {
      username: profileUsername,
      gold: 10,
      exp: 5,
      selectedModel: 3,
      stats: { level: 4, health: 100, maxHealth: 100 },
      inventory: [],
      equipment: [],
      minions: [],
      activityLog: [],
      jobQueue: [],
      ...overrides,
    },
  };
}

describe('validatePlayerSyncPayload', () => {
  it('accepts a bounded owned payload', () => {
    const result = validatePlayerSyncPayload(validBody(), {
      authUserId,
      profileUsername,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.player.stats.level).toBe(4);
      expect(result.player.username).toBe(profileUsername);
    }
  });

  it('rejects username that does not match profile', () => {
    const result = validatePlayerSyncPayload(validBody({ username: 'other-name' }), {
      authUserId,
      profileUsername,
    });
    expect(result).toEqual({
      ok: false,
      error: 'Username does not match the authenticated profile.',
    });
  });

  it('rejects mismatched ownership claims', () => {
    const result = validatePlayerSyncPayload(validBody(), {
      authUserId: 'other-user',
      profileUsername,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/does not match the authenticated user/);
    }
  });

  it('rejects level outside bounds', () => {
    const tooHigh = validatePlayerSyncPayload(
      validBody({ stats: { level: MAX_PLAYER_LEVEL + 1 } }),
      { authUserId, profileUsername },
    );
    expect(tooHigh.ok).toBe(false);
    if (!tooHigh.ok) {
      expect(tooHigh.error).toMatch(new RegExp(`between 1 and ${MAX_PLAYER_LEVEL}`));
    }

    const tooLow = validatePlayerSyncPayload(
      validBody({ stats: { level: 0 } }),
      { authUserId, profileUsername },
    );
    expect(tooLow.ok).toBe(false);
  });

  it('rejects oversized inventory arrays', () => {
    const result = validatePlayerSyncPayload(
      validBody({ inventory: Array.from({ length: PLAYER_SYNC_MAX_INVENTORY_ITEMS + 1 }, () => ({})) }),
      { authUserId, profileUsername },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/inventory exceeds/);
    }
  });

  it('rejects negative gold', () => {
    const result = validatePlayerSyncPayload(validBody({ gold: -1 }), {
      authUserId,
      profileUsername,
    });
    expect(result).toEqual({
      ok: false,
      error: 'Gold must be a non-negative number.',
    });
  });
});

describe('shouldFallbackPlayerSyncToDirectWrite', () => {
  it('falls back only for not-ready / unavailable statuses', () => {
    expect(shouldFallbackPlayerSyncToDirectWrite(501)).toBe(true);
    expect(shouldFallbackPlayerSyncToDirectWrite(503)).toBe(true);
    expect(shouldFallbackPlayerSyncToDirectWrite(400)).toBe(false);
    expect(shouldFallbackPlayerSyncToDirectWrite(401)).toBe(false);
    expect(shouldFallbackPlayerSyncToDirectWrite(500)).toBe(false);
    expect(shouldFallbackPlayerSyncToDirectWrite(200)).toBe(false);
  });
});
