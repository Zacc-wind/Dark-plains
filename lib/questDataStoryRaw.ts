import type { StoryChapter } from './questDataTypes';
import { STORY_CHAPTERS_RAW_A } from './questDataStoryRawA';
import { STORY_CHAPTERS_RAW_B } from './questDataStoryRawB';

export const STORY_CHAPTERS_RAW: StoryChapter[] = [
  ...STORY_CHAPTERS_RAW_A,
  ...STORY_CHAPTERS_RAW_B,
];
