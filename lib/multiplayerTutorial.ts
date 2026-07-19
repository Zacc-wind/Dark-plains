import { readAccountTutorials, writeAccountTutorials } from '@/lib/accountTutorial';
import {
  MULTIPLAYER_UNLOCK_DIALOGUE_IDS,
  type MultiplayerUnlockDialogueId,
} from '@/lib/multiplayerUnlockDialogue';

export type MultiplayerTutorialCalloutId =
  | 'jobs-open'
  | 'job-start'
  | 'harborview-travel'
  | 'enemy-risk'
  | 'formation-confirm'
  | 'commander-loss-warning'
  | 'battle-result-claim';

export interface MultiplayerTutorialDialogueProgress {
  sequenceId: string;
  lineIndex: number;
}

export interface MultiplayerTutorialProgress {
  completedCalloutIds: MultiplayerTutorialCalloutId[];
  completedUnlockDialogueIds?: MultiplayerUnlockDialogueId[];
  activeDialogue?: MultiplayerTutorialDialogueProgress;
  skipped?: boolean;
  updatedAt?: number;
}

export const MULTIPLAYER_TUTORIAL_CALLOUT_IDS: MultiplayerTutorialCalloutId[] = [
  'jobs-open',
  'job-start',
  'harborview-travel',
  'enemy-risk',
  'formation-confirm',
  'commander-loss-warning',
  'battle-result-claim',
];

export const MULTIPLAYER_TUTORIAL_CHANGE_EVENT = 'wizardy:multiplayer-tutorial-change';
export const MULTIPLAYER_FIND_WORK_EVENT = 'wizardy:multiplayer-find-work';

export const MULTIPLAYER_TUTORIAL_CALLOUTS_BY_STORY: Record<string, MultiplayerTutorialCalloutId[]> = {
  'story-01-first-banner': ['jobs-open', 'job-start'],
  'story-02-candle-road': ['harborview-travel'],
  'story-04-river-law': [
    'enemy-risk',
    'formation-confirm',
    'commander-loss-warning',
    'battle-result-claim',
  ],
};

export function normalizeMultiplayerTutorialProgress(
  progress: Partial<MultiplayerTutorialProgress> | null | undefined,
): MultiplayerTutorialProgress {
  const validCallouts = new Set(MULTIPLAYER_TUTORIAL_CALLOUT_IDS);
  const completedCalloutIds = Array.from(new Set(
    (progress?.completedCalloutIds || []).filter((calloutId): calloutId is MultiplayerTutorialCalloutId => (
      validCallouts.has(calloutId as MultiplayerTutorialCalloutId)
    )),
  ));
  const validUnlockDialogues = new Set(MULTIPLAYER_UNLOCK_DIALOGUE_IDS);
  const completedUnlockDialogueIds = Array.from(new Set(
    (progress?.completedUnlockDialogueIds || []).filter((dialogueId): dialogueId is MultiplayerUnlockDialogueId => (
      validUnlockDialogues.has(dialogueId as MultiplayerUnlockDialogueId)
    )),
  ));
  const activeDialogue = progress?.activeDialogue?.sequenceId
    ? {
        sequenceId: progress.activeDialogue.sequenceId,
        lineIndex: Math.max(0, Math.floor(progress.activeDialogue.lineIndex || 0)),
      }
    : undefined;

  return {
    completedCalloutIds,
    completedUnlockDialogueIds,
    activeDialogue,
    skipped: Boolean(progress?.skipped),
    updatedAt: progress?.updatedAt,
  };
}

export function readMultiplayerTutorialProgress(username?: string | null): MultiplayerTutorialProgress {
  if (!username) return normalizeMultiplayerTutorialProgress(null);
  return normalizeMultiplayerTutorialProgress(readAccountTutorials(username).multiplayer);
}

function writeMultiplayerTutorialProgress(
  username: string,
  progress: MultiplayerTutorialProgress,
): MultiplayerTutorialProgress {
  const normalized = normalizeMultiplayerTutorialProgress(progress);
  const account = readAccountTutorials(username);
  writeAccountTutorials(username, { ...account, multiplayer: normalized });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MULTIPLAYER_TUTORIAL_CHANGE_EVENT, {
      detail: { username, progress: normalized },
    }));
  }
  return normalized;
}

export function completeMultiplayerTutorialCallout(
  username: string | null | undefined,
  calloutId: MultiplayerTutorialCalloutId,
): MultiplayerTutorialProgress {
  if (!username) return normalizeMultiplayerTutorialProgress(null);
  const current = readMultiplayerTutorialProgress(username);
  if (current.skipped || current.completedCalloutIds.includes(calloutId)) return current;
  return writeMultiplayerTutorialProgress(username, {
    ...current,
    completedCalloutIds: [...current.completedCalloutIds, calloutId],
    updatedAt: Date.now(),
  });
}

export function completeMultiplayerUnlockDialogue(
  username: string | null | undefined,
  dialogueId: MultiplayerUnlockDialogueId,
): MultiplayerTutorialProgress {
  if (!username) return normalizeMultiplayerTutorialProgress(null);
  const current = readMultiplayerTutorialProgress(username);
  if (current.completedUnlockDialogueIds?.includes(dialogueId)) return current;
  return writeMultiplayerTutorialProgress(username, {
    ...current,
    completedUnlockDialogueIds: [...(current.completedUnlockDialogueIds || []), dialogueId],
    updatedAt: Date.now(),
  });
}

export function getNextMultiplayerTutorialCallout(
  username: string | null | undefined,
  activeStoryQuestId?: string | null,
): MultiplayerTutorialCalloutId | null {
  const progress = readMultiplayerTutorialProgress(username);
  if (!username || progress.skipped) return null;
  const candidates = activeStoryQuestId === undefined
    ? MULTIPLAYER_TUTORIAL_CALLOUT_IDS
    : activeStoryQuestId
      ? MULTIPLAYER_TUTORIAL_CALLOUTS_BY_STORY[activeStoryQuestId] || []
      : [];
  return candidates.find(calloutId => !progress.completedCalloutIds.includes(calloutId)) || null;
}

export function saveMultiplayerTutorialDialogueLine(
  username: string | null | undefined,
  sequenceId: string,
  lineIndex: number,
): MultiplayerTutorialProgress {
  if (!username || !sequenceId) return normalizeMultiplayerTutorialProgress(null);
  const current = readMultiplayerTutorialProgress(username);
  const nextLineIndex = Math.max(0, Math.floor(lineIndex));
  if (current.activeDialogue?.sequenceId === sequenceId && current.activeDialogue.lineIndex === nextLineIndex) {
    return current;
  }
  return writeMultiplayerTutorialProgress(username, {
    ...current,
    activeDialogue: { sequenceId, lineIndex: nextLineIndex },
    updatedAt: Date.now(),
  });
}

export function getMultiplayerTutorialDialogueLine(
  username: string | null | undefined,
  sequenceId: string,
): number {
  const dialogue = readMultiplayerTutorialProgress(username).activeDialogue;
  return dialogue?.sequenceId === sequenceId ? dialogue.lineIndex : 0;
}

export function clearMultiplayerTutorialDialogue(
  username: string | null | undefined,
  sequenceId: string,
): MultiplayerTutorialProgress {
  if (!username) return normalizeMultiplayerTutorialProgress(null);
  const current = readMultiplayerTutorialProgress(username);
  if (current.activeDialogue?.sequenceId !== sequenceId) return current;
  return writeMultiplayerTutorialProgress(username, {
    ...current,
    activeDialogue: undefined,
    updatedAt: Date.now(),
  });
}

export function skipMultiplayerTutorial(username: string | null | undefined): MultiplayerTutorialProgress {
  if (!username) return normalizeMultiplayerTutorialProgress(null);
  const current = readMultiplayerTutorialProgress(username);
  return writeMultiplayerTutorialProgress(username, {
    ...current,
    completedCalloutIds: MULTIPLAYER_TUTORIAL_CALLOUT_IDS,
    activeDialogue: undefined,
    skipped: true,
    updatedAt: Date.now(),
  });
}
