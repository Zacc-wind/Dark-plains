import { describe, expect, it } from 'vitest';
import type { DailyRunHistoryEntry, DailyRunState } from './auth';
import {
  getAvailableRunStartBlessings,
  getRunStartBlessingEffects,
  isRunStartBlessingUnlocked,
  normalizeRunStartBlessingId,
  RUN_START_BLESSINGS,
} from './runBlessings';

const COMPLETED_AT = Date.UTC(2026, 7, 11, 12, 0, 0);

function makeHistoryEntry(overrides: Partial<DailyRunHistoryEntry> = {}): DailyRunHistoryEntry {
  return {
    id: 'run-1',
    date: '2026-08-11',
    completedAt: COMPLETED_AT,
    wins: 5,
    targetBattles: 5,
    unitsStanding: 4,
    gold: 100,
    exp: 80,
    streakAfter: 1,
    ...overrides,
  };
}

function makeState(overrides: Partial<DailyRunState> = {}): DailyRunState {
  return {
    streak: 0,
    bestWins: 0,
    completions: 0,
    history: [],
    runLevel: 1,
    runExp: 0,
    runUpgradePoints: 0,
    permanentStats: {
      armyPower: 0,
      defensivePower: 0,
      morale: 0,
      spellPower: 0,
      maxHealth: 0,
      unitPower: 0,
      unitWard: 0,
    },
    claimedMilestoneIds: [],
    milestoneUnlocks: [],
    ...overrides,
  };
}

describe('run start blessings', () => {
  it('keeps every blessing locked on a fresh profile', () => {
    const views = getAvailableRunStartBlessings(makeState());
    expect(views).toHaveLength(RUN_START_BLESSINGS.length);
    expect(views.every(view => !view.unlocked)).toBe(true);
    expect(normalizeRunStartBlessingId(makeState(), 'purse-start')).toBeUndefined();
  });

  it('unlocks Travel Purse after the first road clear milestone', () => {
    const state = makeState({
      completions: 1,
      history: [makeHistoryEntry()],
    });

    expect(isRunStartBlessingUnlocked(state, 'purse-start')).toBe(true);
    expect(isRunStartBlessingUnlocked(state, 'omen-sight')).toBe(false);
    expect(normalizeRunStartBlessingId(state, 'purse-start')).toBe('purse-start');
    expect(getRunStartBlessingEffects('purse-start')).toEqual({ runGold: 75 });
  });

  it('gates First Stride, Omen Sight, and class blessings on their milestones', () => {
    const state = makeState({
      completions: 1,
      history: [makeHistoryEntry({
        wins: 5,
        unitClassIds: ['priest', 'templar', 'knight'],
        omens: ['Moon Reflection'],
      })],
    });

    expect(isRunStartBlessingUnlocked(state, 'first-stride')).toBe(true);
    expect(isRunStartBlessingUnlocked(state, 'travel-draught')).toBe(true);
    expect(isRunStartBlessingUnlocked(state, 'iron-ward')).toBe(true);
    expect(isRunStartBlessingUnlocked(state, 'omen-sight')).toBe(true);
    expect(isRunStartBlessingUnlocked(state, 'drill-start')).toBe(true);
    expect(getRunStartBlessingEffects('first-stride')).toEqual({ firstBattleMoveBonus: 1 });
    expect(getRunStartBlessingEffects('omen-sight')).toEqual({ omenRerollBonus: 1 });
  });

  it('rejects locked blessing ids even when requested', () => {
    expect(normalizeRunStartBlessingId(makeState({ completions: 1 }), 'drill-start')).toBeUndefined();
  });
});
