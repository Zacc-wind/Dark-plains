import { describe, expect, it } from 'vitest';
import {
  JOB_DURATION_LABELS,
  JOB_REWARD_MULTIPLIER,
  JOB_WORK_DURATIONS_MS,
  getJobRewardPreview,
} from './auth';

const POI_TYPES = [
  'forest',
  'mountain',
  'farm',
  'hunting_lodge',
  'windmill',
  'crab_trap',
  'fishing_dock',
  'granite_quarry',
  'coffee_plantation',
  'campfire',
  'town',
] as const;

describe('multiplayer job balance', () => {
  it('uses the deliberate one-minute through one-hour work tiers', () => {
    expect([...JOB_WORK_DURATIONS_MS]).toEqual([
      60_000,
      10 * 60_000,
      30 * 60_000,
      60 * 60_000,
    ]);
    expect([...JOB_DURATION_LABELS]).toEqual(['1 min', '10 min', '30 min', '1 hour']);
  });

  it('reduces base gold and XP payouts by seventy percent', () => {
    expect(JOB_REWARD_MULTIPLIER).toBe(0.3);
    expect(getJobRewardPreview(0)).toMatchObject({ gold: 3, exp: 2 });
    expect(getJobRewardPreview(3)).toMatchObject({ gold: 17, exp: 7 });
    expect(getJobRewardPreview(3, 'mountain')).toMatchObject({ gold: 29, exp: 7 });
  });

  it('keeps later-level work relevant without changing the early economy', () => {
    const earlyReward = getJobRewardPreview(3, 'mountain', 5);
    const veteranReward = getJobRewardPreview(3, 'mountain', 20);
    const commandReward = getJobRewardPreview(3, 'mountain', 30);

    expect(earlyReward).toMatchObject({ gold: 29, exp: 7 });
    expect(veteranReward.gold).toBeGreaterThan(earlyReward.gold);
    expect(veteranReward.exp).toBeGreaterThan(earlyReward.exp);
    expect(commandReward.gold).toBeGreaterThan(veteranReward.gold);
    expect(commandReward.exp).toBeGreaterThan(veteranReward.exp);
  });

  it('keeps rare gems exclusive to the one-hour tier', () => {
    for (const poiType of POI_TYPES) {
      expect(getJobRewardPreview(0, poiType).rareGems).toBeUndefined();
      expect(getJobRewardPreview(1, poiType).rareGems).toBeUndefined();
      expect(getJobRewardPreview(2, poiType).rareGems).toBeUndefined();
    }

    expect(getJobRewardPreview(3, 'mountain').rareGems).toBe(2);
  });
});
