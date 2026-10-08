import type { StoryChapter } from './questDataTypes';
import { CHAPTER1_QUESTS_P1 } from './questDataStoryRawA1';
import { CHAPTER1_QUESTS_P2 } from './questDataStoryRawA2';

export const STORY_CHAPTERS_RAW_A: StoryChapter[] = [
  {
    id: 'chapter-1',
    title: 'Chapter I: The Eclipsed Banner',
    summary: 'A new commander gathers minions, studies king-magic, and follows the trail of a war-wizard whose eclipse army broke the old roads.',
    quests: [...CHAPTER1_QUESTS_P1, ...CHAPTER1_QUESTS_P2],
  },
];
