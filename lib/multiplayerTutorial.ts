import { readAccountTutorials, writeAccountTutorials } from '@/lib/accountTutorial';

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

export function normalizeMultiplayerTutorialProgress(
  progress: Partial<MultiplayerTutorialProgress> | null | undefined,
): MultiplayerTutorialProgress {
  const validCallouts = new Set(MULTIPLAYER_TUTORIAL_CALLOUT_IDS);
  const completedCalloutIds = Array.from(new Set(
    (progress?.completedCalloutIds || []).filter((calloutId): calloutId is MultiplayerTutorialCalloutId => (
      validCallouts.has(calloutId as MultiplayerTutorialCalloutId)
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

export function getNextMultiplayerTutorialCallout(
  username: string | null | undefined,
): MultiplayerTutorialCalloutId | null {
  const progress = readMultiplayerTutorialProgress(username);
  if (!username || progress.skipped) return null;
  return MULTIPLAYER_TUTORIAL_CALLOUT_IDS.find(calloutId => !progress.completedCalloutIds.includes(calloutId)) || null;
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
  return writeMultiplayerTutorialProgress(username, {
    completedCalloutIds: MULTIPLAYER_TUTORIAL_CALLOUT_IDS,
    activeDialogue: undefined,
    skipped: true,
    updatedAt: Date.now(),
  });
}
