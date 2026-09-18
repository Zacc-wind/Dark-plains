import type { StoryDialogSequence } from './storyDialogueTypes';
import { storyDialoguePartA } from './storyDialoguePartA';
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
  ...storyDialoguePartA,
  ...storyDialoguePartB,
  ...storyDialoguePartC,
};

export function getStoryDialogSequence(dialogId: string | undefined): StoryDialogSequence | undefined {
  if (!dialogId) return undefined;
  return STORY_DIALOG_SEQUENCES[dialogId];
}
