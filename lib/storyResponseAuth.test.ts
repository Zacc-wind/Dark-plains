import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimStoryQuestReward,
  getCurrentUser,
  getStoryQuestResponseChoiceId,
  login,
  markStoryQuestIntroSeen,
  recordStoryQuestResponse,
  register,
  skipMultiplayerOnboarding,
  updateCurrentUser,
} from './auth';
import { getStoryDialogSequence } from './storyDialogue';

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

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', { localStorage: storage });
});

describe('authored story responses', () => {
  it('offers the three authored tones and stores the first response', () => {
    const sequence = getStoryDialogSequence('story-01-first-banner')!;
    const choices = sequence.lines.flatMap(line => line.choices || []);
    expect(choices.map(choice => choice.tone)).toEqual(['oathbound', 'pragmatic', 'defiant']);

    expect(register('StoryChoiceUser', 'test-password').success).toBe(true);
    expect(login('StoryChoiceUser', 'test-password').success).toBe(true);
    expect(recordStoryQuestResponse('story-01-first-banner', 'first-banner-pragmatic')).toEqual({ success: true });

    const stored = getCurrentUser()!.storyQuests?.find(progress => progress.questId === 'story-01-first-banner');
    expect(stored).toMatchObject({
      claimed: false,
      responseChoiceId: 'first-banner-pragmatic',
      responseTone: 'pragmatic',
    });
    expect(stored?.responseSelectedAt).toEqual(expect.any(Number));
    expect(recordStoryQuestResponse('story-01-first-banner', 'first-banner-defiant')).toEqual({
      success: false,
      error: 'This story response is already set.',
    });
  });

  it('preserves the response through intro, skip, reward claim, and reload', () => {
    expect(register('StoryChoicePersistence', 'test-password').success).toBe(true);
    expect(login('StoryChoicePersistence', 'test-password').success).toBe(true);
    expect(recordStoryQuestResponse('story-01-first-banner', 'first-banner-oathbound').success).toBe(true);

    markStoryQuestIntroSeen('story-01-first-banner');
    skipMultiplayerOnboarding();
    updateCurrentUser({
      activityLog: [{
        id: 'activity-job-story-choice-1',
        type: 'job',
        title: 'Road Work',
        source: 'Harborview',
        completedAt: 1_000,
        rewards: {},
      }],
    });
    expect(claimStoryQuestReward('story-01-first-banner').success).toBe(true);
    expect(getStoryQuestResponseChoiceId(getCurrentUser(), 'story-01-first-banner')).toBe('first-banner-oathbound');

    expect(login('StoryChoicePersistence', 'test-password').success).toBe(true);
    expect(getCurrentUser()!.storyQuests?.find(progress => progress.questId === 'story-01-first-banner')).toMatchObject({
      claimed: true,
      introSeen: true,
      responseChoiceId: 'first-banner-oathbound',
      responseTone: 'oathbound',
    });
  });

  it('rejects choices that do not belong to the quest dialogue', () => {
    expect(register('StoryChoiceInvalid', 'test-password').success).toBe(true);
    expect(login('StoryChoiceInvalid', 'test-password').success).toBe(true);
    expect(recordStoryQuestResponse('story-01-first-banner', 'missing-choice')).toEqual({
      success: false,
      error: 'Story response not found.',
    });
  });
});
