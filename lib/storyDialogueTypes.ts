export type StoryDialogSpeaker = 'player' | 'npc';
export type StoryResponseTone = 'oathbound' | 'pragmatic' | 'defiant';

export interface StoryDialogChoice {
  id: string;
  tone: StoryResponseTone;
  label: string;
  text: string;
}

export interface StoryDialogLine {
  speaker: StoryDialogSpeaker;
  text: string;
  choicePrompt?: string;
  choices?: StoryDialogChoice[];
}

export interface StoryDialogObjective {
  label: string;
  title: string;
  description: string;
}

export interface StoryDialogSequence {
  id: string;
  kicker: string;
  npcName: string;
  npcTitle: string;
  npcModelNumber?: 1 | 2 | 3 | 4 | 5 | 6;
  npcAssetPath?: string;
  objective?: StoryDialogObjective;
  defaultChoiceId?: string;
  lines: StoryDialogLine[];
}
