import { describe, expect, it } from 'vitest';
import {
  getDailyRunState,
  recordDailyRunCompletionState,
  type DailyRunHistoryEntry,
  type DailyRunState,
} from './auth';
import { getRunMilestoneViews, syncRunMilestoneUnlockRecords } from './runMilestones';

const COMPLETED_AT = Date.UTC(2026, 6, 19, 12, 0, 0);

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

function makeHistoryEntry(): DailyRunHistoryEntry {
  return {
    id: 'legacy-run',
    date: '2026-07-19',
    completedAt: COMPLETED_AT,
    wins: 5,
    targetBattles: 5,
    unitsStanding: 7,
    gold: 120,
    exp: 80,
    score: 900,
    durationMs: 120_000,
    bossesDefeated: [],
    flawlessBossNames: [],
    fastBossNames: [],
    routeSummary: ['Hard road'],
    shopBuys: [],
    shopGoldSpent: 0,
    omens: [],
    unlockedSpellNames: [],
    unitTemplateIds: [],
    unitClassIds: [],
    tierThreeUnitNames: [],
    runLevelAfter: 1,
    streakAfter: 1,
  };
}

describe('singleplayer milestone unlock records', () => {
  it('does not create records for a fresh run profile', () => {
    expect(syncRunMilestoneUnlockRecords(makeState(), COMPLETED_AT).milestoneUnlocks).toEqual([]);
  });

  it('records first unlock time, tier, and display metadata after a completed run', () => {
    const dailyRun = recordDailyRunCompletionState(
      { dailyRun: makeState() },
      {
        ...makeHistoryEntry(),
        completedAt: COMPLETED_AT,
      },
    );
    const roadbreaker = dailyRun.milestoneUnlocks?.find(record => record.id === 'road-first-clear');

    expect(roadbreaker).toMatchObject({
      id: 'road-first-clear',
      unlockedAt: COMPLETED_AT,
      tier: 'bronze',
      title: 'Roadbreaker',
      category: 'road',
      iconPath: '/assets/icons/loot-chest.png',
    });
  });

  it('preserves the original timestamp and unlock after old run history rolls off', () => {
    const unlocked = syncRunMilestoneUnlockRecords(makeState({
      completions: 1,
      history: [makeHistoryEntry()],
    }), COMPLETED_AT);
    const resynced = syncRunMilestoneUnlockRecords({
      ...unlocked,
      completions: 0,
      history: [],
    }, COMPLETED_AT + 50_000);
    const roadbreaker = getRunMilestoneViews(resynced).find(view => view.id === 'road-first-clear');

    expect(resynced.milestoneUnlocks?.find(record => record.id === 'road-first-clear')?.unlockedAt)
      .toBe(COMPLETED_AT);
    expect(roadbreaker?.unlocked).toBe(true);
    expect(roadbreaker?.unlockedAt).toBe(COMPLETED_AT);
  });

  it('migrates legacy run state using the oldest retained completion time', () => {
    const migrated = getDailyRunState({
      dailyRun: makeState({
        completions: 1,
        history: [makeHistoryEntry()],
        milestoneUnlocks: undefined,
      }),
    });

    expect(migrated.milestoneUnlocks?.find(record => record.id === 'road-first-clear'))
      .toMatchObject({ unlockedAt: COMPLETED_AT, title: 'Roadbreaker', tier: 'bronze' });
  });

  it('unlocks exact no-shop, flawless boss, speed, and spending feats from run telemetry', () => {
    const views = getRunMilestoneViews(makeState({
      completions: 1,
      history: [{
        ...makeHistoryEntry(),
        bossesDefeated: ['The Ossuary Candlekeeper'],
        flawlessBossNames: ['The Ossuary Candlekeeper'],
        fastBossNames: ['The Ossuary Candlekeeper'],
        shopGoldSpent: 520,
      }],
    }));
    const unlocked = new Set(views.filter(view => view.unlocked).map(view => view.id));

    expect(unlocked).toContain('road-no-shop-clear');
    expect(unlocked).toContain('boss-flawless-clear');
    expect(unlocked).toContain('boss-speed-clear');
    expect(unlocked).toContain('economy-spend-500');
  });

  it('does not award a no-shop clear for an abandoned route', () => {
    const view = getRunMilestoneViews(makeState({
      history: [{ ...makeHistoryEntry(), wins: 4, targetBattles: 5 }],
    })).find(milestone => milestone.id === 'road-no-shop-clear');

    expect(view?.unlocked).toBe(false);
  });
});
