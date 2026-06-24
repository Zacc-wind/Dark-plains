import { readAccountTutorials, writeAccountTutorials } from '@/lib/accountTutorial';
import { readGameJson } from '@/lib/gameStore';
import type { SingleplayerRunTutorialCard, SingleplayerRunTutorialStep } from '@/lib/singleplayerTutorial';
import { SINGLEPLAYER_RUN_TUTORIAL_GUIDE_ASSET } from '@/lib/singleplayerTutorial';

export type ModeTutorialStepId =
  | 'mode-tutorial-choice'
  | 'mode-split'
  | 'mode-singleplayer'
  | 'mode-multiplayer';

export interface ModeTutorialProgress {
  completed: boolean;
  skipped?: boolean;
  updatedAt?: number;
}

export interface ModeTutorialStep extends Omit<SingleplayerRunTutorialStep, 'id'> {
  id: ModeTutorialStepId;
}

const MODE_TUTORIAL_PROGRESS_PREFIX = 'wizardy_mode_tutorial_progress';

function getProgressKey(username: string): string {
  return `${MODE_TUTORIAL_PROGRESS_PREFIX}_${username}`;
}

function normalizeModeTutorialProgress(progress: Partial<ModeTutorialProgress> | null | undefined): ModeTutorialProgress {
  return {
    completed: Boolean(progress?.completed),
    skipped: Boolean(progress?.skipped),
    updatedAt: progress?.updatedAt,
  };
}

export function readModeTutorialProgress(username?: string | null): ModeTutorialProgress {
  if (!username) return normalizeModeTutorialProgress(null);

  const accountProgress = readAccountTutorials(username).mode;
  if (accountProgress?.completed) return normalizeModeTutorialProgress(accountProgress);

  // Legacy local-only progress from before account sync.
  const legacyProgress = readGameJson<ModeTutorialProgress | null>(getProgressKey(username), null);
  if (legacyProgress?.completed) {
    writeAccountTutorials(username, { ...readAccountTutorials(username), mode: normalizeModeTutorialProgress(legacyProgress) });
    return normalizeModeTutorialProgress(legacyProgress);
  }

  return normalizeModeTutorialProgress(accountProgress ?? legacyProgress);
}
export function shouldShowModeTutorial(username?: string | null): boolean {
  if (!username) return false;
  return !readModeTutorialProgress(username).completed;
}

export function completeModeTutorial(username?: string | null): ModeTutorialProgress {
  const next = normalizeModeTutorialProgress({ completed: true, updatedAt: Date.now() });
  if (username) {
    const account = readAccountTutorials(username);
    writeAccountTutorials(username, { ...account, mode: next });
  }
  return next;
}

export function skipModeTutorial(username?: string | null): ModeTutorialProgress {
  const next = normalizeModeTutorialProgress({ completed: true, skipped: true, updatedAt: Date.now() });
  if (username) {
    const account = readAccountTutorials(username);
    writeAccountTutorials(username, { ...account, mode: next });
  }
  return next;
}

function makeCards(cards: SingleplayerRunTutorialCard[]): SingleplayerRunTutorialCard[] {
  return cards;
}

export function createModeTutorialStep(id: ModeTutorialStepId): ModeTutorialStep {
  const base: Record<ModeTutorialStepId, Omit<SingleplayerRunTutorialStep, 'id' | 'guideAssetPath'>> = {
    'mode-tutorial-choice': {
      kicker: 'First Login',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Gate Tutor',
      title: 'Before you choose a road.',
      body: 'Dark Plains has two separate ways to play. I can explain the split now, or you can skip and choose a mode immediately.',
      hint: 'This appears only before your first mode choice. You can still swap modes later.',
      continueLabel: 'Continue Tutorial',
    },
    'mode-split': {
      kicker: 'Two Roads',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Gate Tutor',
      title: 'Singleplayer and Multiplayer are separate games.',
      body: 'Singleplayer uses its own roguelike run level, run history, temporary armies, and permanent run upgrades. Multiplayer uses the shared world-map commander, towns, quests, gear, social play, and party systems.',
      hint: 'Progress in one road should not accidentally overpower the other.',
      continueLabel: 'Continue Tutorial',
      cards: makeCards([
        { title: 'Separate Progress', body: 'Run upgrades stay in singleplayer. World gear stays in multiplayer.', iconPath: '/assets/icons/defense.png' },
        { title: 'Swap Anytime', body: 'The mode button lets you return to this choice later.', iconPath: '/assets/icons/magic.png' },
      ]),
    },
    'mode-singleplayer': {
      kicker: 'Singleplayer',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Run Tutor',
      title: 'Singleplayer is the roguelike road.',
      body: 'Draft a temporary warband, choose branching fights, buy run-only upgrades, defeat bosses, and grow permanent run strength between attempts. Retreat or defeat only ends that run.',
      hint: 'Choose this when you want fast tactical battles and build progression without world-map pressure.',
      continueLabel: 'Continue Tutorial',
      cards: makeCards([
        { title: 'Temporary Army', body: 'Draft and upgrade units inside each run.', iconPath: '/assets/icons/attack.png' },
        { title: 'Permanent Run Level', body: 'Clears unlock run-only power over time.', iconPath: '/assets/icons/magic.png' },
        { title: 'No World Penalty', body: 'Retreat simply ends the attempt.', iconPath: '/assets/icons/healing.png' },
      ]),
    },
    'mode-multiplayer': {
      kicker: 'Multiplayer',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'World Tutor',
      title: 'Multiplayer is the shared world map.',
      body: 'Travel between towns, meet players, take quests, collect persistent gear, form parties, and prepare for duels, trades, and cooperative dungeons.',
      hint: 'Choose this when you want social progression and the persistent commander profile.',
      continueLabel: 'Choose Mode',
      cards: makeCards([
        { title: 'Persistent Commander', body: 'Gear, gold, quests, and army belong to the world-map profile.', iconPath: '/assets/icons/loot-chest.png' },
        { title: 'Social Play', body: 'Friends, parties, trades, and challenges live here.', iconPath: '/assets/icons/gold.png' },
        { title: 'Co-op Dungeons', body: 'Parties will fight longer roads together.', iconPath: '/assets/icons/attack.png' },
      ]),
    },
  };

  return {
    id,
    guideAssetPath: SINGLEPLAYER_RUN_TUTORIAL_GUIDE_ASSET,
    ...base[id],
  };
}

export const MODE_TUTORIAL_STEP_IDS: ModeTutorialStepId[] = [
  'mode-tutorial-choice',
  'mode-split',
  'mode-singleplayer',
  'mode-multiplayer',
];
