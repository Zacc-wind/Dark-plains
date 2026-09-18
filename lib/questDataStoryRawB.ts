import type { StoryChapter } from './questDataTypes';
import { CHAPTER2_QUESTS_P1 } from './questDataStoryRawB1';
import { CHAPTER2_QUESTS_P2 } from './questDataStoryRawB2';

export const STORY_CHAPTERS_RAW_B: StoryChapter[] = [
  {
    id: 'chapter-2',
    title: 'Chapter II: The Mirror Court',
    summary: 'The broken crown was only the first seal. A mirror court rises in the east, and every road you cleared now feeds its war.',
    quests: [...CHAPTER2_QUESTS_P1, ...CHAPTER2_QUESTS_P2],
  },
];
