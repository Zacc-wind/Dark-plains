import type { StoryChapter } from './questDataTypes';
import { CHAPTER2_QUESTS_P1 } from './questDataStoryRawB1';
import { CHAPTER2_QUESTS_P2 } from './questDataStoryRawB2';

export const STORY_CHAPTERS_RAW_B: StoryChapter[] = [
  {
    id: 'chapter-2',
    title: 'Chapter II: The Mirror Court',
    summary: 'After the Broken Crown, glass roads and candle keys open the path to Lady Mirror-Veyra and the court that rewrites living law.',
    quests: [...CHAPTER2_QUESTS_P1, ...CHAPTER2_QUESTS_P2],
  },
];
