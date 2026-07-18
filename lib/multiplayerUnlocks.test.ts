import { describe, expect, it } from 'vitest';
import {
  getMultiplayerSubjectLevel,
  getMultiplayerUnlockStatus,
  MULTIPLAYER_UNLOCK_REGISTRY,
  requireMultiplayerUnlock,
} from '@/lib/multiplayerUnlocks';

describe('multiplayer unlock registry', () => {
  it('keeps the intended level bands in one registry', () => {
    expect(MULTIPLAYER_UNLOCK_REGISTRY.jobs.minLevel).toBe(1);
    expect(MULTIPLAYER_UNLOCK_REGISTRY['city-contracts'].minLevel).toBe(2);
    expect(MULTIPLAYER_UNLOCK_REGISTRY['pvp-challenges'].minLevel).toBe(3);
    expect(MULTIPLAYER_UNLOCK_REGISTRY.trading.minLevel).toBe(4);
    expect(MULTIPLAYER_UNLOCK_REGISTRY.party.minLevel).toBe(5);
  });

  it('normalizes malformed or missing player levels to level one', () => {
    expect(getMultiplayerSubjectLevel(null)).toBe(1);
    expect(getMultiplayerSubjectLevel({ stats: { level: Number.NaN } })).toBe(1);
    expect(getMultiplayerSubjectLevel(3.9)).toBe(3);
  });

  it('returns compact preview metadata for locked features', () => {
    expect(getMultiplayerUnlockStatus('pvp-hub', { stats: { level: 2 } })).toMatchObject({
      unlocked: false,
      minLevel: 3,
      requirement: 'Unlocks at level 3',
    });
  });

  it('uses the same rule for action guards', () => {
    expect(requireMultiplayerUnlock('party', { stats: { level: 4 } })).toEqual({
      allowed: false,
      error: 'Party Creation unlocks at level 5.',
    });
    expect(requireMultiplayerUnlock('party', { stats: { level: 5 } })).toEqual({ allowed: true });
  });
});
