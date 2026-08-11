import type { DailyRunState } from '@/lib/auth';
import { getRunMilestoneViews } from '@/lib/runMilestones';

export type RunStartBlessingId =
  | 'purse-start'
  | 'travel-draught'
  | 'first-stride'
  | 'iron-ward'
  | 'omen-sight'
  | 'drill-start';

export interface RunStartBlessingDefinition {
  id: RunStartBlessingId;
  name: string;
  description: string;
  iconPath: string;
  unlockMilestoneId: string;
  unlockHint: string;
}

export interface RunStartBlessingEffects {
  runGold?: number;
  commanderHealth?: number;
  defensivePower?: number;
  armyPower?: number;
  firstBattleMoveBonus?: number;
  omenRerollBonus?: number;
}

export interface RunStartBlessingView extends RunStartBlessingDefinition {
  unlocked: boolean;
}

export const RUN_START_BLESSINGS: RunStartBlessingDefinition[] = [
  {
    id: 'purse-start',
    name: 'Travel Purse',
    description: 'Begin the road with 75 run gold.',
    iconPath: '/assets/icons/gold.png',
    unlockMilestoneId: 'road-first-clear',
    unlockHint: 'Clear any run road.',
  },
  {
    id: 'travel-draught',
    name: 'Travel Draught',
    description: 'Start with +25 commander health.',
    iconPath: '/assets/icons/health.png',
    unlockMilestoneId: 'army-priest-recruit',
    unlockHint: 'Recruit a priest-class minion.',
  },
  {
    id: 'first-stride',
    name: 'First Stride',
    description: 'Commander gains +1 movement in the first battle.',
    iconPath: '/assets/icons/speed.png',
    unlockMilestoneId: 'road-five-wins',
    unlockHint: 'Finish a run with at least five wins.',
  },
  {
    id: 'iron-ward',
    name: 'Iron Ward',
    description: 'Begin with +1 ward (defensive power).',
    iconPath: '/assets/icons/defense.png',
    unlockMilestoneId: 'army-templar-recruit',
    unlockHint: 'Field a templar-class minion.',
  },
  {
    id: 'omen-sight',
    name: 'Omen Sight',
    description: 'Begin with one extra omen reroll.',
    iconPath: '/assets/icons/rare-gem.png',
    unlockMilestoneId: 'economy-omen',
    unlockHint: 'Resolve an omen on a run.',
  },
  {
    id: 'drill-start',
    name: 'Road Drill',
    description: 'Begin with +1 army power.',
    iconPath: '/assets/icons/attack.png',
    unlockMilestoneId: 'army-knight-recruit',
    unlockHint: 'Field a knight-class minion in a cleared run.',
  },
];

const EFFECTS_BY_ID: Record<RunStartBlessingId, RunStartBlessingEffects> = {
  'purse-start': { runGold: 75 },
  'travel-draught': { commanderHealth: 25 },
  'first-stride': { firstBattleMoveBonus: 1 },
  'iron-ward': { defensivePower: 1 },
  'omen-sight': { omenRerollBonus: 1 },
  'drill-start': { armyPower: 1 },
};

export function getRunStartBlessing(id: string | null | undefined): RunStartBlessingDefinition | undefined {
  if (!id) return undefined;
  return RUN_START_BLESSINGS.find(blessing => blessing.id === id);
}

export function getRunStartBlessingEffects(id: RunStartBlessingId): RunStartBlessingEffects {
  return { ...EFFECTS_BY_ID[id] };
}

export function isRunStartBlessingUnlocked(state: DailyRunState, blessingId: RunStartBlessingId): boolean {
  const blessing = getRunStartBlessing(blessingId);
  if (!blessing) return false;
  return getRunMilestoneViews(state).some(view => view.id === blessing.unlockMilestoneId && view.unlocked);
}

export function getAvailableRunStartBlessings(state: DailyRunState): RunStartBlessingView[] {
  return RUN_START_BLESSINGS.map(blessing => ({
    ...blessing,
    unlocked: isRunStartBlessingUnlocked(state, blessing.id),
  }));
}

export function normalizeRunStartBlessingId(
  state: DailyRunState,
  blessingId: string | null | undefined,
): RunStartBlessingId | undefined {
  const blessing = getRunStartBlessing(blessingId);
  if (!blessing) return undefined;
  return isRunStartBlessingUnlocked(state, blessing.id) ? blessing.id : undefined;
}
