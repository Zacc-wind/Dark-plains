import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseConfigured: () => false,
}));

import { applyRemoteAccountTutorials, readAccountTutorials } from '@/lib/accountTutorial';
import {
  clearMultiplayerTutorialDialogue,
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
    expect(getNextMultiplayerTutorialCallout('ReturningBanner', 'story-03-lost-apprentice')).toBeNull();
    expect(getNextMultiplayerTutorialCallout('ReturningBanner', 'story-04-river-law')).toBe('enemy-risk');
    expect(getNextMultiplayerTutorialCallout('ReturningBanner', null)).toBeNull();
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

  it('recovers partial callout and dialogue progress after module reload', async () => {
    completeMultiplayerTutorialCallout('ReloadBanner', 'jobs-open');
    saveMultiplayerTutorialDialogueLine('ReloadBanner', 'story-01-first-banner', 1);

    vi.resetModules();
    const reloaded = await import('@/lib/multiplayerTutorial');

    expect(reloaded.getNextMultiplayerTutorialCallout('ReloadBanner', 'story-01-first-banner')).toBe('job-start');
    expect(reloaded.getMultiplayerTutorialDialogueLine('ReloadBanner', 'story-01-first-banner')).toBe(1);
  });
});
