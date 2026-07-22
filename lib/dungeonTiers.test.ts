import { describe, expect, it } from 'vitest';
import {
  formatDungeonTier,
  getActiveDungeons,
  getDungeonRequiredPlayerLevel,
  getDungeonTier,
} from './worldEvents';

describe('multiplayer dungeon tiers', () => {
  it('maps dungeon difficulty bands to explicit player-level gates', () => {
    expect([1, 6, 7, 11, 12, 25].map(getDungeonTier)).toEqual([1, 1, 2, 2, 3, 3]);
    expect([1, 6, 7, 11, 12, 25].map(getDungeonRequiredPlayerLevel)).toEqual([2, 2, 7, 7, 16, 16]);
    expect(([1, 2, 3] as const).map(formatDungeonTier)).toEqual(['I', 'II', 'III']);
  });

  it('includes tier and entry requirements on every rotating dungeon', () => {
    const dungeons = getActiveDungeons(Date.parse('2026-07-22T12:00:00Z'), 8);
    expect(dungeons.length).toBeGreaterThanOrEqual(2);
    dungeons.forEach(dungeon => {
      expect(dungeon.tier).toBe(getDungeonTier(dungeon.level));
      expect(dungeon.requiredPlayerLevel).toBe(getDungeonRequiredPlayerLevel(dungeon.level));
    });
  });
});
