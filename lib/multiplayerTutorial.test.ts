import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseConfigured: () => false,
}));

import { applyRemoteAccountTutorials, readAccountTutorials } from '@/lib/accountTutorial';
import {
  clearMultiplayerTutorialDialogue,
  completeMultiplayerUnlockDialogue,
  completeMultiplayerTutorialCallout,
  getMultiplayerTutorialDialogueLine,
  getNextMultiplayerTutorialCallout,
  MULTIPLAYER_TUTORIAL_CALLOUTS_BY_STORY,
  MULTIPLAYER_TUTORIAL_CALLOUT_IDS,
  MULTIPLAYER_TUTORIAL_CHANGE_EVENT,
  readMultiplayerTutorialProgress,
  saveMultiplayerTutorialDialogueLine,
  skipMultiplayerTutorial,
} from '@/lib/multiplayerTutorial';
import { getNextMultiplayerUnlockDialogue } from '@/lib/multiplayerUnlockDialogue';

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

describe('multiplayer tutorial progress', () => {
  it('advances the First Banner steps only after their real actions complete', () => {
    expect(getNextMultiplayerTutorialCallout('FreshBanner', 'story-01-first-banner')).toBe('jobs-open');

    completeMultiplayerTutorialCallout('FreshBanner', 'jobs-open');
    expect(getNextMultiplayerTutorialCallout('FreshBanner', 'story-01-first-banner')).toBe('job-start');

    completeMultiplayerTutorialCallout('FreshBanner', 'job-start');
    expect(getNextMultiplayerTutorialCallout('FreshBanner', 'story-01-first-banner')).toBeNull();
    expect(readMultiplayerTutorialProgress('FreshBanner').completedCalloutIds).toEqual([
      'jobs-open',
      'job-start',
    ]);
  });

  it('scopes callouts to the active story instead of blocking on older unfinished steps', () => {
    expect(getNextMultiplayerTutorialCallout('ReturningBanner', 'story-02-candle-road')).toBe('harborview-travel');
    expect(getNextMultiplayerTutorialCallout('ReturningBanner', 'story-03-lost-apprentice')).toBe('marshal-orren-contact');
    expect(getNextMultiplayerTutorialCallout('ReturningBanner', 'story-04-river-law')).toBe('enemy-risk');
    expect(getNextMultiplayerTutorialCallout('ReturningBanner', null)).toBeNull();
  });

  it('completes the Marshal Orren contact lesson only from its recorded interaction', () => {
    expect(getNextMultiplayerTutorialCallout('MusterBanner', 'story-03-lost-apprentice')).toBe('marshal-orren-contact');

    completeMultiplayerTutorialCallout('MusterBanner', 'marshal-orren-contact');

    expect(getNextMultiplayerTutorialCallout('MusterBanner', 'story-03-lost-apprentice')).toBeNull();
  });

  it('advances every Trial by Steel interaction in order', () => {
    for (const calloutId of MULTIPLAYER_TUTORIAL_CALLOUTS_BY_STORY['story-04-river-law']) {
      expect(getNextMultiplayerTutorialCallout('SteelBanner', 'story-04-river-law')).toBe(calloutId);
      completeMultiplayerTutorialCallout('SteelBanner', calloutId);
    }

    expect(getNextMultiplayerTutorialCallout('SteelBanner', 'story-04-river-law')).toBeNull();
  });

  it('persists completion in account JSON and emits a live change event', () => {
    const progress = completeMultiplayerTutorialCallout('EventBanner', 'jobs-open');

    expect(readAccountTutorials('EventBanner').multiplayer).toEqual(progress);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: MULTIPLAYER_TUTORIAL_CHANGE_EVENT,
      detail: { username: 'EventBanner', progress },
    }));
  });

  it('keeps newer local callout progress when older remote data arrives', () => {
    completeMultiplayerTutorialCallout('MergeBanner', 'jobs-open');

    applyRemoteAccountTutorials('MergeBanner', {
      multiplayer: {
        completedCalloutIds: [],
        skipped: false,
        updatedAt: Date.now() - 1000,
      },
    });

    expect(readMultiplayerTutorialProgress('MergeBanner').completedCalloutIds).toEqual(['jobs-open']);
  });

  it('resumes and clears the exact active dialogue line', () => {
    saveMultiplayerTutorialDialogueLine('DialogueBanner', 'story-02-candle-road', 2.8);

    expect(getMultiplayerTutorialDialogueLine('DialogueBanner', 'story-02-candle-road')).toBe(2);
    expect(getMultiplayerTutorialDialogueLine('DialogueBanner', 'story-01-first-banner')).toBe(0);

    clearMultiplayerTutorialDialogue('DialogueBanner', 'story-02-candle-road');
    expect(getMultiplayerTutorialDialogueLine('DialogueBanner', 'story-02-candle-road')).toBe(0);
  });

  it('skips all callouts without completing story objectives', () => {
    const progress = skipMultiplayerTutorial('SkipBanner');

    expect(progress.completedCalloutIds).toEqual(MULTIPLAYER_TUTORIAL_CALLOUT_IDS);
    expect(progress.skipped).toBe(true);
    expect(getNextMultiplayerTutorialCallout('SkipBanner', 'story-04-river-law')).toBeNull();
  });

  it('queues and persists the level two through five unlock briefings in order', () => {
    expect(getNextMultiplayerUnlockDialogue(1, [])).toBeNull();
    expect(getNextMultiplayerUnlockDialogue(2, [])?.id).toBe('unlock-level-2-forge');

    completeMultiplayerUnlockDialogue('RankBanner', 'unlock-level-2-forge');
    let progress = readMultiplayerTutorialProgress('RankBanner');
    expect(getNextMultiplayerUnlockDialogue(3, progress.completedUnlockDialogueIds || [])?.id)
      .toBe('unlock-level-3-pvp');

    completeMultiplayerUnlockDialogue('RankBanner', 'unlock-level-3-pvp');
    progress = readMultiplayerTutorialProgress('RankBanner');
    expect(getNextMultiplayerUnlockDialogue(4, progress.completedUnlockDialogueIds || [])?.id)
      .toBe('unlock-level-4-trading');

    completeMultiplayerUnlockDialogue('RankBanner', 'unlock-level-4-trading');
    progress = readMultiplayerTutorialProgress('RankBanner');
    expect(getNextMultiplayerUnlockDialogue(5, progress.completedUnlockDialogueIds || [])?.id)
      .toBe('unlock-level-5-company');

    completeMultiplayerUnlockDialogue('RankBanner', 'unlock-level-5-company');
    progress = readMultiplayerTutorialProgress('RankBanner');
    expect(progress.completedUnlockDialogueIds).toEqual([
      'unlock-level-2-forge',
      'unlock-level-3-pvp',
      'unlock-level-4-trading',
      'unlock-level-5-company',
    ]);
    expect(getNextMultiplayerUnlockDialogue(30, progress.completedUnlockDialogueIds || [])).toBeNull();
  });

  it('preserves completed unlock briefings when callouts are skipped', () => {
    completeMultiplayerUnlockDialogue('SkipRankBanner', 'unlock-level-3-pvp');

    const progress = skipMultiplayerTutorial('SkipRankBanner');

    expect(progress.completedUnlockDialogueIds).toEqual(['unlock-level-3-pvp']);
  });

  it('recovers partial callout and dialogue progress after module reload', async () => {
    completeMultiplayerTutorialCallout('ReloadBanner', 'jobs-open');
    saveMultiplayerTutorialDialogueLine('ReloadBanner', 'story-01-first-banner', 1);

    vi.resetModules();
    const reloaded = await import('@/lib/multiplayerTutorial');

    expect(reloaded.getNextMultiplayerTutorialCallout('ReloadBanner', 'story-01-first-banner')).toBe('job-start');
    expect(reloaded.getMultiplayerTutorialDialogueLine('ReloadBanner', 'story-01-first-banner')).toBe(1);
  });
});
