import { describe, expect, it } from 'vitest';
import {
  MULTIPLAYER_REWARD_BANDS,
  capCampaignRewardExp,
  getMultiplayerRewardBand,
  scaleMultiplayerRewards,
} from './multiplayerRewards';

describe('multiplayer reward progression', () => {
  it('keeps onboarding payouts unchanged', () => {
    expect(scaleMultiplayerRewards({ gold: 40, exp: 25 }, 1, 'contract')).toEqual({ gold: 40, exp: 25 });
    expect(scaleMultiplayerRewards({ gold: 40, exp: 25 }, 5, 'job')).toEqual({ gold: 40, exp: 25 });
  });

  it('uses stable five-level bands through the current level cap', () => {
    expect(MULTIPLAYER_REWARD_BANDS).toHaveLength(6);
    expect(getMultiplayerRewardBand(6).id).toBe('regional');
    expect(getMultiplayerRewardBand(17).id).toBe('veteran');
    expect(getMultiplayerRewardBand(30).id).toBe('command');
    expect(getMultiplayerRewardBand(999).id).toBe('command');
  });

  it('grows every multiplayer source without making repeatable co-op rewards scale fastest', () => {
    const base = { gold: 100, exp: 100 };
    const lateJob = scaleMultiplayerRewards(base, 30, 'job');
    const lateContract = scaleMultiplayerRewards(base, 30, 'contract');
    const latePve = scaleMultiplayerRewards(base, 30, 'pve');
    const latePvp = scaleMultiplayerRewards(base, 30, 'pvp');
    const lateCoop = scaleMultiplayerRewards(base, 30, 'coop');

    [lateJob, lateContract, latePve, latePvp, lateCoop].forEach(reward => {
      expect(reward.gold).toBeGreaterThan(base.gold);
      expect(reward.exp).toBeGreaterThan(base.exp);
    });
    expect(lateJob.exp).toBeGreaterThan(lateContract.exp);
    expect(lateContract.exp).toBeGreaterThan(lateCoop.exp);
  });

  it('caps campaign XP at eighty percent of the current level requirement', () => {
    expect(capCampaignRewardExp(900, 1000)).toBe(800);
    expect(capCampaignRewardExp(650, 1000)).toBe(650);
  });
});
