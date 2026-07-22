import { describe, expect, it } from 'vitest';
import {
  getMultiplayerSubjectLevel,
  getMultiplayerUnlockLevelGroups,
  getMultiplayerUnlockStatus,
  getNextMultiplayerUnlocks,
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
    expect(MULTIPLAYER_UNLOCK_REGISTRY['dungeon-tier-ii'].minLevel).toBe(7);
    expect(MULTIPLAYER_UNLOCK_REGISTRY['dungeon-tier-iii'].minLevel).toBe(16);
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

  it('builds a stable level path and previews only later implemented unlocks', () => {
    const groups = getMultiplayerUnlockLevelGroups({ stats: { level: 3 } });
    expect(groups.map(group => group.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 16]);
    expect(groups.find(group => group.level === 3)?.current).toBe(true);
    expect(groups.find(group => group.level === 4)?.unlocked).toBe(false);
    expect(getNextMultiplayerUnlocks({ stats: { level: 3 } }, 2).map(item => item.id)).toEqual([
      'trading',
      'coop-dungeons',
    ]);
  });
});
