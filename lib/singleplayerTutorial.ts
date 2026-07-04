import { readAccountTutorials, writeAccountTutorials } from '@/lib/accountTutorial';
import { readGameJson, writeGameJson } from '@/lib/gameStore';

export type SingleplayerRunTutorialStepId =
  | 'lobby'
  | 'run-setup'
  | 'draft'
  | 'route-map'
  | 'formation'
  | 'combat'
  | 'reward'
  | 'shop'
  | 'omen';

export interface SingleplayerRunTutorialCard {
  title: string;
  body: string;
  iconPath: string;
}

export interface SingleplayerRunTutorialStep {
  id: SingleplayerRunTutorialStepId;
  kicker: string;
  speakerName: string;
  speakerTitle: string;
  title: string;
  body: string;
  hint?: string;
  guideAssetPath: string;
  continueLabel?: string;
  cards?: SingleplayerRunTutorialCard[];
}

export interface SingleplayerRunTutorialProgress {
  seenStepIds: SingleplayerRunTutorialStepId[];
  completed: boolean;
  skipped?: boolean;
  updatedAt?: number;
}

export const SINGLEPLAYER_RUN_TUTORIAL_SETTING_KEY = 'wizardy_singleplayer_run_tutorial_enabled';
export const SINGLEPLAYER_RUN_TUTORIAL_GUIDE_ASSET = '/assets/bosses/boss8.png';

export const SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS: SingleplayerRunTutorialStepId[] = [
  'lobby',
  'run-setup',
  'draft',
  'route-map',
  'formation',
  'combat',
  'reward',
  'shop',
  'omen',
];

const SINGLEPLAYER_RUN_TUTORIAL_PROGRESS_PREFIX = 'wizardy_singleplayer_run_tutorial_progress';

function getProgressKey(username: string): string {
  return `${SINGLEPLAYER_RUN_TUTORIAL_PROGRESS_PREFIX}_${username}`;
}

function normalizeProgress(progress: Partial<SingleplayerRunTutorialProgress> | null | undefined): SingleplayerRunTutorialProgress {
  const validSteps = new Set(SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS);
  const seenStepIds = Array.from(new Set((progress?.seenStepIds || []).filter((step): step is SingleplayerRunTutorialStepId => validSteps.has(step as SingleplayerRunTutorialStepId))));
  return {
    seenStepIds,
    completed: Boolean(progress?.completed) || seenStepIds.length >= SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS.length,
    skipped: Boolean(progress?.skipped),
    updatedAt: progress?.updatedAt,
  };
}

export function readSingleplayerRunTutorialEnabled(): boolean {
  return readGameJson<boolean>(SINGLEPLAYER_RUN_TUTORIAL_SETTING_KEY, true) !== false;
}

export function writeSingleplayerRunTutorialEnabled(enabled: boolean): void {
  writeGameJson(SINGLEPLAYER_RUN_TUTORIAL_SETTING_KEY, enabled);
}

export function readSingleplayerRunTutorialProgress(username?: string | null): SingleplayerRunTutorialProgress {
  if (!username) return normalizeProgress(null);

  const accountProgress = readAccountTutorials(username).singleplayerRun;
  if (accountProgress?.completed || (accountProgress?.seenStepIds?.length || 0) > 0) {
    return normalizeProgress(accountProgress);
  }

  const legacyProgress = readGameJson<SingleplayerRunTutorialProgress | null>(getProgressKey(username), null);
  if (legacyProgress?.completed || (legacyProgress?.seenStepIds?.length || 0) > 0) {
    writeAccountTutorials(username, { ...readAccountTutorials(username), singleplayerRun: normalizeProgress(legacyProgress) });
    return normalizeProgress(legacyProgress);
  }

  return normalizeProgress(accountProgress ?? legacyProgress);
}
export function markSingleplayerRunTutorialStepSeen(username: string | null | undefined, stepId: SingleplayerRunTutorialStepId): SingleplayerRunTutorialProgress {
  if (!username) return normalizeProgress(null);
  const current = readSingleplayerRunTutorialProgress(username);
  const seenStepIds = Array.from(new Set([...current.seenStepIds, stepId]));
  const next = normalizeProgress({
    ...current,
    seenStepIds,
    completed: seenStepIds.length >= SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS.length,
    updatedAt: Date.now(),
  });
  const account = readAccountTutorials(username);
  writeAccountTutorials(username, { ...account, singleplayerRun: next });
  return next;
}

export function skipSingleplayerRunTutorial(username: string | null | undefined): SingleplayerRunTutorialProgress {
  if (!username) return normalizeProgress(null);
  const next = normalizeProgress({
    seenStepIds: SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS,
    completed: true,
    skipped: true,
    updatedAt: Date.now(),
  });
  const account = readAccountTutorials(username);
  writeAccountTutorials(username, { ...account, singleplayerRun: next });
  writeSingleplayerRunTutorialEnabled(true);
  return next;
}

export function resetSingleplayerRunTutorial(username: string | null | undefined): SingleplayerRunTutorialProgress {
  const next = normalizeProgress({ seenStepIds: [], completed: false, updatedAt: Date.now() });
  if (username) {
    const account = readAccountTutorials(username);
    writeAccountTutorials(username, { ...account, singleplayerRun: next });
  }
  writeSingleplayerRunTutorialEnabled(true);
  return next;
}

export function shouldShowSingleplayerRunTutorialStep(username: string | null | undefined, stepId: SingleplayerRunTutorialStepId): boolean {
  if (!username || !readSingleplayerRunTutorialEnabled()) return false;
  const progress = readSingleplayerRunTutorialProgress(username);
  return !progress.completed && !progress.seenStepIds.includes(stepId);
}

export function createSingleplayerRunTutorialStep(
  id: SingleplayerRunTutorialStepId,
  overrides?: Partial<Omit<SingleplayerRunTutorialStep, 'id' | 'guideAssetPath'>>,
): SingleplayerRunTutorialStep {
  const base: Record<SingleplayerRunTutorialStepId, Omit<SingleplayerRunTutorialStep, 'id' | 'guideAssetPath'>> = {
    lobby: {
      kicker: 'Singleplayer Tutorial',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Unwilling Guide',
      title: 'The road begins here.',
      body: 'Each run drafts temporary fighters, spends run-only gold, and builds permanent run strength after victories. Losing or retreating simply ends the attempt.',
      hint: 'Start when you are ready. I will stop the road only the first time a major screen needs explaining.',
      continueLabel: 'Continue Run',
    },
    'run-setup': {
      kicker: 'Run Setup',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Road Tutor',
      title: 'Choose the commander and road before drafting.',
      body: 'The commander choice changes this run with a passive bonus. The road length changes pressure and rewards. These choices shape the draft before the first unit is picked.',
      hint: 'Quick, short, and standard roads are open from run level 1. Long roads unlock at run level 5 and pay stronger run rewards.',
      continueLabel: 'Continue Run',
      cards: [
        { title: 'Commander', body: 'Pick the leader whose passive fits your plan.', iconPath: '/assets/playermodel1.png' },
        { title: 'Passive', body: 'The selected passive applies only inside this run.', iconPath: '/assets/icons/magic.png' },
        { title: 'Road Length', body: 'Quick, short, and standard are open now. Long unlocks at run level 5.', iconPath: '/assets/icons/attack.png' },
      ],
    },
    draft: {
      kicker: 'Draft',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Warband Tutor',
      title: 'Choose seven temporary fighters.',
      body: 'Each pick adds one unit to this run only. A stable first road usually wants one healer, one durable frontliner, and at least one ranged or spell unit.',
      hint: 'The choices refresh after every pick, so build around what the road offers.',
      continueLabel: 'Continue Run',
      cards: [
        { title: 'Frontliners', body: 'Guard wounded units and hold pressure.', iconPath: '/assets/icons/defense.png' },
        { title: 'Healers', body: 'Keep health high across the whole run.', iconPath: '/assets/icons/healing.png' },
        { title: 'Casters', body: 'Bring range, magic damage, and control.', iconPath: '/assets/icons/magic.png' },
      ],
    },
    'route-map': {
      kicker: 'Road Map',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Road Tutor',
      title: 'The road branches, but it does not forgive bad choices.',
      body: 'Fight nodes advance the run. Shops and omens are free stops. Hard routes are more dangerous, but they grant an extra omen after victory.',
      hint: 'Bosses sit along the route and the final boss ends the run.',
      continueLabel: 'Continue Run',
      cards: [
        { title: 'Fight', body: 'Win to move deeper and earn run gold.', iconPath: '/assets/icons/attack.png' },
        { title: 'Hard Route', body: 'Stronger enemies, then a bonus omen.', iconPath: '/assets/icons/defense.png' },
        { title: 'Shop', body: 'Spend run gold. No battle count spent.', iconPath: '/assets/icons/gold.png' },
        { title: 'Omen', body: 'Risk fate for healing, recruits, or power.', iconPath: '/assets/icons/magic.png' },
        { title: 'Boss', body: 'Major gates. The last boss ends the road.', iconPath: '/assets/bosses/boss8.png' },
        { title: 'Locked', body: 'Dim nodes open when the path reaches them.', iconPath: '/assets/icons/loot-chest.png' },
      ],
    },
    formation: {
      kicker: 'Formation',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Deployment Tutor',
      title: 'Place the warband before the blades move.',
      body: 'You may carry up to ten units in the run, but only seven fight at once. Front slots absorb pressure; rear slots protect priests, wizards, and wounded units.',
      hint: 'Unit health persists between fights, so benching a wounded fighter can matter.',
      continueLabel: 'Continue Run',
      cards: [
        { title: 'Seven Fielded', body: 'Only seven units can fight at once.', iconPath: '/assets/icons/attack.png' },
        { title: 'Ten Carried', body: 'Extra units stay ready on the bench.', iconPath: '/assets/icons/health.png' },
        { title: 'Wounds Stay', body: 'Health carries into the next battle.', iconPath: '/assets/icons/healing.png' },
      ],
    },
    combat: {
      kicker: 'Combat',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Battle Tutor',
      title: 'Watch the glow. Act with intent.',
      body: 'The highlighted unit is active. Move, strike, heal, wait, or use commander tools when they appear. The commander can focus mana or cast equipped spells.',
      hint: 'Hover enemies to preview damage and retaliation. Waiting is useful when a healer or commander needs setup.',
      continueLabel: 'Continue Run',
      cards: [
        { title: 'Move', body: 'Blue paths reposition the active unit.', iconPath: '/assets/icons/speed.png' },
        { title: 'Strike', body: 'Red attacks show damage before you commit.', iconPath: '/assets/icons/attack.png' },
        { title: 'Heal', body: 'Priest-line units restore allies.', iconPath: '/assets/icons/healing.png' },
        { title: 'Wait', body: 'Some units gain guard, blessing, or setup.', iconPath: '/assets/icons/defense.png' },
        { title: 'Commander', body: 'Focus mana or cast equipped spells.', iconPath: '/assets/icons/magic.png' },
      ],
    },
    reward: {
      kicker: 'Blessing',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Spoils Tutor',
      title: 'After victory, choose one run blessing.',
      body: 'Blessings last only for this run. Some improve the whole army, some add units, some grant gear or spells. Rerolls are limited.',
      hint: 'Pick for the roster you still have, not the roster you wish you had.',
      continueLabel: 'Continue Run',
      cards: [
        { title: 'Army Power', body: 'Raises the whole warband for this run.', iconPath: '/assets/icons/attack.png' },
        { title: 'Gear', body: 'Adds temporary commander equipment.', iconPath: '/assets/icons/loot-chest.png' },
        { title: 'Spellbook', body: 'Adds a run spell to your options.', iconPath: '/assets/icons/magic.png' },
        { title: 'Rerolls', body: 'Limited. Save them for bad choices.', iconPath: '/assets/icons/dice.png' },
      ],
    },
    shop: {
      kicker: 'Road Shop',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Coin Tutor',
      title: 'Spend run gold before the next bloodletting.',
      body: 'Road shops use the gold earned inside this run. You can buy every offer you can afford, and shop rerolls refresh the entire stock.',
      hint: 'Healing, recruits, and gear are usually stronger before hard routes or bosses.',
      continueLabel: 'Continue Run',
      cards: [
        { title: 'Run Gold', body: 'Earned from enemies, spent only here.', iconPath: '/assets/icons/gold.png' },
        { title: 'Buy Many', body: 'The shop stays open after a purchase.', iconPath: '/assets/icons/loot-chest.png' },
        { title: 'Refresh', body: 'Rerolls replace the full shop stock.', iconPath: '/assets/icons/dice.png' },
      ],
    },
    omen: {
      kicker: 'Omen',
      speakerName: 'The Grave-Crowned Emperor',
      speakerTitle: 'Fate Tutor',
      title: 'Omens are bargains with bad witnesses.',
      body: 'An omen can heal, upgrade, recruit, pay gold, or twist the run. You have very few omen rerolls, so use them only when the result does not fit your plan.',
      hint: 'Hard-route bonus omens are one reason to risk stronger enemies.',
      continueLabel: 'Continue Run',
      cards: [
        { title: 'Blessing', body: 'Fate can strengthen the whole run.', iconPath: '/assets/icons/magic.png' },
        { title: 'Recovery', body: 'Some omens heal or revive the roster.', iconPath: '/assets/icons/healing.png' },
        { title: 'Risk', body: 'Bad omens can wound or pressure you.', iconPath: '/assets/icons/attack.png' },
      ],
    },
  };

  return {
    id,
    guideAssetPath: SINGLEPLAYER_RUN_TUTORIAL_GUIDE_ASSET,
    ...base[id],
    ...overrides,
  };
}
