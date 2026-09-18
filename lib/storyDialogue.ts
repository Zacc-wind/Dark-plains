import type { StoryDialogSequence } from './storyDialogueTypes';
import { storyDialoguePartA1 } from './storyDialoguePartA1';
import { storyDialoguePartA2 } from './storyDialoguePartA2';
import { storyDialoguePartB } from './storyDialoguePartB';
import { storyDialoguePartC } from './storyDialoguePartC';

export type {
  StoryDialogSpeaker,
  StoryResponseTone,
  StoryDialogChoice,
  StoryDialogLine,
  StoryDialogObjective,
  StoryDialogSequence,
} from './storyDialogueTypes';

export const STORY_DIALOG_SEQUENCES: Record<string, StoryDialogSequence> = {
  ...storyDialoguePartA1,
  ...storyDialoguePartA2,
  ...storyDialoguePartB,
  ...storyDialoguePartC,
};

export function getStoryDialogSequence(dialogId: string | undefined): StoryDialogSequence | undefined {
  if (!dialogId) return undefined;
  return STORY_DIALOG_SEQUENCES[dialogId];
}
