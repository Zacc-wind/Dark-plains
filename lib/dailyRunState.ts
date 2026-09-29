// Daily/random run save normalization, kept free of lib/auth so server routes can use it.
import type { DailyRunState, MinionClass, RandomRunPermanentStats, User } from './playerTypes';
import { normalizeRunDiscoveryState, syncRunDiscoveryState } from './runDiscovery';
import { syncRunMilestoneUnlockRecords } from './runMilestones';

export const RANDOM_RUN_BALANCE = {
  levelCap: 15,
  routeBattleMin: 12,
  routeBattleMax: 15,
  enemyLevelCap: 15,
  bossSpacing: 5,
  minBosses: 2,
  currentContentBosses: 8,
  maxBankedCapLevels: 2,
} as const;

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getRandomRunEffectiveLevel(level: number): number {
  return Math.max(1, Math.min(RANDOM_RUN_BALANCE.levelCap, Math.floor(toFiniteNumber(level, 1))));
}

export function capRandomRunPermanentStats(stats: RandomRunPermanentStats, _runLevel: number = RANDOM_RUN_BALANCE.levelCap): RandomRunPermanentStats {
  void _runLevel;
  return {
    armyPower: Math.max(0, Math.floor(toFiniteNumber(stats.armyPower, 0))),
    defensivePower: Math.max(0, Math.floor(toFiniteNumber(stats.defensivePower, 0))),
    morale: Math.max(0, Math.floor(toFiniteNumber(stats.morale, 0))),
    spellPower: Math.max(0, Math.floor(toFiniteNumber(stats.spellPower, 0))),
    maxHealth: Math.max(0, Math.floor(toFiniteNumber(stats.maxHealth, 0))),
    unitPower: Math.max(0, Math.floor(toFiniteNumber(stats.unitPower, 0))),
    unitWard: Math.max(0, Math.floor(toFiniteNumber(stats.unitWard, 0))),
  };
}

export function normalizeRandomRunPermanentStats(stats?: Partial<RandomRunPermanentStats> | null): RandomRunPermanentStats {
  const normalized = {
    armyPower: Math.max(0, Math.floor(toFiniteNumber(stats?.armyPower, 0))),
    defensivePower: Math.max(0, Math.floor(toFiniteNumber(stats?.defensivePower, 0))),
    morale: Math.max(0, Math.floor(toFiniteNumber(stats?.morale, 0))),
    spellPower: Math.max(0, Math.floor(toFiniteNumber(stats?.spellPower, 0))),
    maxHealth: Math.max(0, Math.floor(toFiniteNumber(stats?.maxHealth, 0))),
    unitPower: Math.max(0, Math.floor(toFiniteNumber(stats?.unitPower, 0))),
    unitWard: Math.max(0, Math.floor(toFiniteNumber(stats?.unitWard, 0))),
  };

  return capRandomRunPermanentStats(normalized);
}

export function normalizeDailyRunState(
  state?: Partial<DailyRunState> | null,
  legacySpellIds: readonly string[] = [],
): DailyRunState {
  const runLevel = getRandomRunEffectiveLevel(toFiniteNumber(state?.runLevel, 1));
  const runExp = Math.max(0, Math.floor(toFiniteNumber(state?.runExp, 0)));
  const history = (state?.history || []).slice(0, 12).map(entry => ({
    ...entry,
    wins: Math.max(0, Math.floor(toFiniteNumber(entry.wins, 0))),
    targetBattles: Math.max(1, Math.floor(toFiniteNumber(entry.targetBattles, 1))),
    unitsStanding: Math.max(0, Math.floor(toFiniteNumber(entry.unitsStanding, 0))),
    gold: Math.max(0, Math.floor(toFiniteNumber(entry.gold, 0))),
    exp: Math.max(0, Math.floor(toFiniteNumber(entry.exp, 0))),
    score: Math.max(0, Math.floor(toFiniteNumber(entry.score, 0))),
    durationMs: Math.max(0, Math.floor(toFiniteNumber(entry.durationMs, 0))),
    bossesDefeated: (entry.bossesDefeated || []).slice(0, 6),
    flawlessBossNames: (entry.flawlessBossNames || []).filter(Boolean).slice(0, 6),
    fastBossNames: (entry.fastBossNames || []).filter(Boolean).slice(0, 6),
    routeSummary: (entry.routeSummary || []).slice(0, 24),
    shopBuys: (entry.shopBuys || []).slice(0, 24),
    shopGoldSpent: Math.max(0, Math.floor(toFiniteNumber(entry.shopGoldSpent, 0))),
    omens: (entry.omens || []).slice(0, 24),
    unlockedSpellNames: (entry.unlockedSpellNames || []).slice(0, 12),
    temporarySpellIds: (entry.temporarySpellIds || []).filter(Boolean).slice(0, 20),
    unitTemplateIds: (entry.unitTemplateIds || []).filter(Boolean).slice(0, 24),
    unitClassIds: (entry.unitClassIds || []).filter(Boolean).slice(0, 8) as MinionClass[],
    tierThreeUnitNames: (entry.tierThreeUnitNames || []).filter(Boolean).slice(0, 12),
    healingDone: Math.max(0, Math.floor(toFiniteNumber(entry.healingDone, 0))),
    unitsLost: Math.max(0, Math.floor(toFiniteNumber(entry.unitsLost, 0))),
    lowestCommanderHealthRatio: Math.max(0, Math.min(1, toFiniteNumber(entry.lowestCommanderHealthRatio, 1))),
    commanderUntouchedBattles: Math.max(0, Math.floor(toFiniteNumber(entry.commanderUntouchedBattles, 0))),
    challengeModifierIds: Array.from(new Set((entry.challengeModifierIds || []).filter(Boolean))).slice(0, 12),
    discoveryOfferIdsSeen: Array.from(new Set((entry.discoveryOfferIdsSeen || []).filter(Boolean))).slice(0, 36),
    runLevelAfter: Math.max(1, Math.floor(toFiniteNumber(entry.runLevelAfter, runLevel))),
    streakAfter: Math.max(0, Math.floor(toFiniteNumber(entry.streakAfter, 0))),
  }));

  const normalized: DailyRunState = {
    lastCompletedDate: state?.lastCompletedDate,
    streak: Math.max(0, Math.floor(toFiniteNumber(state?.streak, 0))),
    bestWins: Math.max(0, Math.floor(toFiniteNumber(state?.bestWins, 0))),
    completions: Math.max(0, Math.floor(toFiniteNumber(state?.completions, 0))),
    history,
    runLevel,
    runExp,
    runUpgradePoints: Math.max(0, Math.floor(toFiniteNumber(state?.runUpgradePoints, 0))),
    permanentStats: capRandomRunPermanentStats(normalizeRandomRunPermanentStats(state?.permanentStats)),
    claimedMilestoneIds: Array.from(new Set((state?.claimedMilestoneIds || []).filter(Boolean))).slice(0, 64),
    milestoneUnlocks: (state?.milestoneUnlocks || []).filter(record => (
      Boolean(record?.id) && Number.isFinite(record?.unlockedAt)
    )),
    discovery: normalizeRunDiscoveryState(state?.discovery, legacySpellIds, history),
  };

  const migrationTimestamp = history[history.length - 1]?.completedAt || 1;
  const withMilestones = syncRunMilestoneUnlockRecords(normalized, migrationTimestamp);
  return {
    ...withMilestones,
    discovery: syncRunDiscoveryState(withMilestones, legacySpellIds, migrationTimestamp),
  };
}

export function normalizeUserDailyRunState(
  user: (Pick<User, 'dailyRun'> & Partial<Pick<User, 'knownSpellIds'>>) | null | undefined,
): DailyRunState {
  return normalizeDailyRunState(user?.dailyRun, user?.knownSpellIds || []);
}
