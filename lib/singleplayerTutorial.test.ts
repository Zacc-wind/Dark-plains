import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseConfigured: () => false,
}));

import { readAccountTutorials } from '@/lib/accountTutorial';
import { writeGameJson } from '@/lib/gameStore';
import {
  markSingleplayerRunRewardTipSeen,
  markSingleplayerRunTutorialStepSeen,
  readSingleplayerRunTutorialEnabled,
  readSingleplayerRunTutorialProgress,
  resetSingleplayerRunTutorial,
  shouldShowSingleplayerRunRewardTip,
  shouldShowSingleplayerRunTutorialStep,
  SINGLEPLAYER_RUN_REWARD_TIP_IDS,
  SINGLEPLAYER_RUN_TUTORIAL_RESET_EVENT,
  SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS,
  skipSingleplayerRunTutorial,
  writeSingleplayerRunTutorialEnabled,
} from '@/lib/singleplayerTutorial';

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
const dispatchEvent = vi.fn();

beforeEach(() => {
  storage.clear();
  dispatchEvent.mockReset();
  vi.stubGlobal('window', { localStorage: storage, dispatchEvent });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-18T12:00:00Z'));
});

describe('singleplayer run tutorial progress', () => {
  it('starts fresh with every checkpoint and reward tip available', () => {
    const progress = readSingleplayerRunTutorialProgress('FreshMage');

    expect(progress).toMatchObject({
      seenStepIds: [],
      seenRewardTipIds: [],
      completed: false,
      skipped: false,
    });
    expect(readSingleplayerRunTutorialEnabled()).toBe(true);
    expect(SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS.every(stepId => (
      shouldShowSingleplayerRunTutorialStep('FreshMage', stepId)
    ))).toBe(true);
  });

  it('persists all nine checkpoints in order and completes on the ninth', () => {
    SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS.forEach((stepId, index) => {
      expect(shouldShowSingleplayerRunTutorialStep('OrderedMage', stepId)).toBe(true);

      const progress = markSingleplayerRunTutorialStepSeen('OrderedMage', stepId);

      expect(progress.seenStepIds).toEqual(SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS.slice(0, index + 1));
      expect(progress.completed).toBe(index === SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS.length - 1);
      expect(shouldShowSingleplayerRunTutorialStep('OrderedMage', stepId)).toBe(false);
    });
  });

  it('skips every checkpoint and one-time reward tip without disabling the setting', () => {
    const progress = skipSingleplayerRunTutorial('SkippingMage');

    expect(progress).toMatchObject({ completed: true, skipped: true });
    expect(progress.seenStepIds).toEqual(SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS);
    expect(progress.seenRewardTipIds).toEqual(SINGLEPLAYER_RUN_REWARD_TIP_IDS);
    expect(readSingleplayerRunTutorialEnabled()).toBe(true);
  });

  it('resets progress, reward tips, the setting, and the live run listener', () => {
    skipSingleplayerRunTutorial('ResetMage');
    writeSingleplayerRunTutorialEnabled(false);

    const progress = resetSingleplayerRunTutorial('ResetMage');

    expect(progress).toMatchObject({
      seenStepIds: [],
      seenRewardTipIds: [],
      completed: false,
      skipped: false,
    });
    expect(readSingleplayerRunTutorialEnabled()).toBe(true);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0][0]).toMatchObject({
      type: SINGLEPLAYER_RUN_TUTORIAL_RESET_EVENT,
      detail: { username: 'ResetMage' },
    });
  });

  it('shows each reward tip once and persists the seen state', () => {
    expect(shouldShowSingleplayerRunRewardTip('RewardMage', 'gear')).toBe(true);
    expect(shouldShowSingleplayerRunRewardTip('RewardMage', 'unit-upgrade')).toBe(true);

    markSingleplayerRunRewardTipSeen('RewardMage', 'gear');
    markSingleplayerRunRewardTipSeen('RewardMage', 'gear');

    expect(shouldShowSingleplayerRunRewardTip('RewardMage', 'gear')).toBe(false);
    expect(shouldShowSingleplayerRunRewardTip('RewardMage', 'unit-upgrade')).toBe(true);
    expect(readSingleplayerRunTutorialProgress('RewardMage').seenRewardTipIds).toEqual(['gear']);
  });

  it('migrates valid legacy progress into the account tutorial payload', () => {
    writeGameJson('wizardy_singleplayer_run_tutorial_progress_LegacyMage', {
      seenStepIds: ['lobby', 'draft', 'invalid-step', 'draft'],
      completed: false,
      updatedAt: 42,
    });

    const progress = readSingleplayerRunTutorialProgress('LegacyMage');

    expect(progress.seenStepIds).toEqual(['lobby', 'draft']);
    expect(readAccountTutorials('LegacyMage').singleplayerRun).toEqual(progress);
  });

  it('recovers account progress after the tutorial modules reload', async () => {
    markSingleplayerRunTutorialStepSeen('ReloadMage', 'lobby');
    markSingleplayerRunTutorialStepSeen('ReloadMage', 'run-setup');
    markSingleplayerRunRewardTipSeen('ReloadMage', 'gear');

    vi.resetModules();
    const reloaded = await import('@/lib/singleplayerTutorial');
    const progress = reloaded.readSingleplayerRunTutorialProgress('ReloadMage');

    expect(progress.seenStepIds).toEqual(['lobby', 'run-setup']);
    expect(progress.seenRewardTipIds).toEqual(['gear']);
    expect(reloaded.shouldShowSingleplayerRunTutorialStep('ReloadMage', 'draft')).toBe(true);
  });
});
