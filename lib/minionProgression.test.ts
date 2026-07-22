import { describe, expect, it } from 'vitest';
import { canAcquireMinionTier, getMinionTierMinLevel } from './minionProgression';

describe('multiplayer unit tier progression', () => {
  it('unlocks Tier II at level four and Tier III at level seven', () => {
    expect(getMinionTierMinLevel('tier1')).toBe(1);
    expect(getMinionTierMinLevel('tier2')).toBe(4);
    expect(getMinionTierMinLevel('tier3')).toBe(7);
    expect(canAcquireMinionTier('tier2', 3)).toBe(false);
    expect(canAcquireMinionTier('tier2', 4)).toBe(true);
    expect(canAcquireMinionTier('tier3', 6)).toBe(false);
    expect(canAcquireMinionTier('tier3', 7)).toBe(true);
  });
});
