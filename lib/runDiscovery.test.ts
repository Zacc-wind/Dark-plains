import { describe, expect, it } from 'vitest';
import type { DailyRunHistoryEntry, DailyRunState } from './auth';
import {
  normalizeRunDiscoveryState,
  RUN_DISCOVERY_CATALOG,
  RUN_STARTER_SPELL_IDS,
  RUN_STARTER_UNIT_TEMPLATE_IDS,
  syncRunDiscoveryState,
} from './runDiscovery';

const COMPLETED_AT = Date.UTC(2026, 6, 21, 12, 0, 0);

function makeHistoryEntry(overrides: Partial<DailyRunHistoryEntry> = {}): DailyRunHistoryEntry {
  return {
    id: 'run-1',
    date: '2026-07-21',
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
    ...overrides,
  };
}

describe('singleplayer run discovery', () => {
  it('starts fresh profiles with only the four core spells and units', () => {
    const discovery = normalizeRunDiscoveryState(undefined);

    expect(discovery.unlockedSpellIds).toEqual([...RUN_STARTER_SPELL_IDS]);
    expect(discovery.unlockedUnitTemplateIds).toEqual([...RUN_STARTER_UNIT_TEMPLATE_IDS]);
    expect(discovery.pendingOffers).toEqual([]);
  });

  it('contains the planned 16 spell and 20 non-core unit discoveries', () => {
    expect(RUN_DISCOVERY_CATALOG.filter(item => item.kind === 'spell')).toHaveLength(16);
    expect(RUN_DISCOVERY_CATALOG.filter(item => item.kind === 'unit')).toHaveLength(20);
  });

  it('copies legacy account spells and encountered units exactly once', () => {
    const migrated = normalizeRunDiscoveryState(
      undefined,
      ['eclipse-nova'],
      [makeHistoryEntry({ unitTemplateIds: ['firelord'] })],
    );
    const reloaded = normalizeRunDiscoveryState(
      migrated,
      ['time-crown-edict'],
      [makeHistoryEntry({ unitTemplateIds: ['mercenary'] })],
    );

    expect(migrated.unlockedSpellIds).toContain('eclipse-nova');
    expect(migrated.unlockedUnitTemplateIds).toContain('firelord');
    expect(reloaded.unlockedSpellIds).not.toContain('time-crown-edict');
    expect(reloaded.unlockedUnitTemplateIds).not.toContain('mercenary');
  });

  it('unlocks matching spell and unit achievements deterministically', () => {
    const state = makeState({
      runLevel: 5,
      history: [makeHistoryEntry({ wins: 5, targetBattles: 6 })],
    });
    const discovery = syncRunDiscoveryState(state, [], COMPLETED_AT);

    expect(discovery.unlockedSpellIds).toContain('chain-spark');
    expect(discovery.unlockedUnitTemplateIds).toContain('crossbow');
    expect(discovery.pendingOffers.map(offer => offer.id)).toEqual(expect.arrayContaining([
      'spell:chain-spark',
      'unit:crossbow',
    ]));
  });

  it('enforces tier II and tier III run-level gates', () => {
    const history = [makeHistoryEntry({
      bossesDefeated: ['Mother Cindervein'],
      challengeModifierIds: ['iron-road'],
    })];

    const levelFour = syncRunDiscoveryState(makeState({ runLevel: 4, history }), [], COMPLETED_AT);
    const levelFive = syncRunDiscoveryState(makeState({ runLevel: 5, history }), [], COMPLETED_AT);
    const levelSeven = syncRunDiscoveryState(makeState({ runLevel: 7, history }), [], COMPLETED_AT);
    const levelEight = syncRunDiscoveryState(makeState({ runLevel: 8, history }), [], COMPLETED_AT);

    expect(levelFour.unlockedUnitTemplateIds).not.toContain('firelord');
    expect(levelFive.unlockedUnitTemplateIds).toContain('firelord');
    expect(levelSeven.unlockedUnitTemplateIds).not.toContain('templar-paragon');
    expect(levelEight.unlockedUnitTemplateIds).toContain('templar-paragon');
  });

  it('does not duplicate records or pending guarantees when synchronized again', () => {
    const state = makeState({ history: [makeHistoryEntry({ wins: 5 })] });
    const first = syncRunDiscoveryState(state, [], COMPLETED_AT);
    const second = syncRunDiscoveryState({ ...state, discovery: first }, [], COMPLETED_AT + 1000);

    expect(second.unlockRecords).toEqual(first.unlockRecords);
    expect(second.pendingOffers).toEqual(first.pendingOffers);
  });

  it('clears a pending guarantee after the corresponding real offer was recorded', () => {
    const state = makeState({ history: [makeHistoryEntry({ wins: 5 })] });
    const first = syncRunDiscoveryState(state, [], COMPLETED_AT);
    const withSeenOffer = makeState({
      discovery: first,
      history: [makeHistoryEntry({ wins: 5, discoveryOfferIdsSeen: ['spell:chain-spark'] })],
    });
    const next = syncRunDiscoveryState(withSeenOffer, [], COMPLETED_AT + 1000);

    expect(next.pendingOffers.some(offer => offer.id === 'spell:chain-spark')).toBe(false);
    expect(next.unlockedSpellIds).toContain('chain-spark');
  });
});
