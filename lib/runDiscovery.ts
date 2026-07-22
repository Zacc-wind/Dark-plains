import { BOSS_PROFILES } from './bosses';
import { getSpellIconPath } from './spellAssets';
import type { DailyRunHistoryEntry, DailyRunState, MinionClass, MinionTier } from './auth';

export const RUN_DISCOVERY_VERSION = 1;
export const RUN_DISCOVERY_OFFER_WINDOW = 2;

export const RUN_STARTER_SPELL_IDS = [
  'arcane-bolt',
  'sanctified-mend',
  'ember-dart',
  'warding-prayer',
] as const;

export const RUN_STARTER_UNIT_TEMPLATE_IDS = [
  'wizard-apprentice',
  'knight-squire',
  'templar-initiate',
  'priest-acolyte',
] as const;

const ALL_RUN_SPELL_IDS = [
  ...RUN_STARTER_SPELL_IDS,
  'thorn-ward',
  'withering-curse',
  'rallying-hymn',
  'chain-spark',
  'gravity-snare',
  'ashen-step',
  'judgement',
  'royal-command',
  'moonlit-veil',
  'blood-star',
  'iron-benediction',
  'soul-tether',
  'frost-lance',
  'eclipse-nova',
  'saint-king-aegis',
  'time-crown-edict',
] as const;

const ALL_RUN_UNIT_TEMPLATE_IDS = [
  ...RUN_STARTER_UNIT_TEMPLATE_IDS,
  'witchdoc',
  'crossbow',
  'thief',
  'darkpriest',
  'wizard-magus',
  'enchanter',
  'knight-man-at-arms',
  'firelord',
  'archer',
  'templar-crusader',
  'bell',
  'priest-cleric',
  'wizard-archmage',
  'plaugedoc',
  'knight-champion',
  'fallen',
  'mercenary',
  'crow',
  'templar-paragon',
  'priest-high-priest',
] as const;

export type RunDiscoveryKind = 'spell' | 'unit';
export type RunDiscoverySourceType = 'starter' | 'run-level' | 'achievement' | 'boss' | 'legacy';

export interface RunDiscoveryUnlockRecord {
  id: string;
  kind: RunDiscoveryKind;
  contentId: string;
  sourceType: RunDiscoverySourceType;
  sourceId: string;
  unlockedAt: number;
}

export interface RunDiscoveryPendingOffer {
  id: string;
  kind: RunDiscoveryKind;
  contentId: string;
  offerNodesRemaining: number;
  unlockedAt: number;
}

export interface RunDiscoveryState {
  version: number;
  unlockedSpellIds: string[];
  unlockedUnitTemplateIds: string[];
  unlockRecords: RunDiscoveryUnlockRecord[];
  pendingOffers: RunDiscoveryPendingOffer[];
}

export interface RunDiscoveryDefinition {
  key: string;
  kind: RunDiscoveryKind;
  contentId: string;
  name: string;
  description: string;
  iconPath: string;
  sourceType: Exclude<RunDiscoverySourceType, 'starter' | 'legacy'>;
  sourceId: string;
  minRunLevel?: number;
  tier?: MinionTier;
  classId?: MinionClass;
  isEarned: (state: DailyRunState) => boolean;
  progress: (state: DailyRunState) => string;
}

export interface RunDiscoveryView extends RunDiscoveryDefinition {
  unlocked: boolean;
  unlockedAt?: number;
  pendingOffer: boolean;
  progressLabel: string;
}

function discoveryKey(kind: RunDiscoveryKind, contentId: string): string {
  return `${kind}:${contentId}`;
}

function isFullClear(entry: DailyRunHistoryEntry): boolean {
  return entry.targetBattles > 0 && entry.wins >= entry.targetBattles;
}

function maxHistoryValue(state: DailyRunState, select: (entry: DailyRunHistoryEntry) => number): number {
  return Math.max(0, ...state.history.map(select));
}

function hasClearWithClass(state: DailyRunState, classId: MinionClass): boolean {
  return state.history.some(entry => isFullClear(entry) && entry.unitClassIds?.includes(classId));
}

function hasHardRouteClear(state: DailyRunState): boolean {
  return state.history.some(entry => isFullClear(entry) && entry.routeSummary?.some(step => step.toLowerCase().includes('hard')));
}

function hasNoShopClear(state: DailyRunState): boolean {
  return state.history.some(entry => isFullClear(entry) && (entry.shopBuys?.length || 0) === 0);
}

function hasNoLossClear(state: DailyRunState): boolean {
  return state.history.some(entry => isFullClear(entry) && (entry.unitsLost || 0) === 0);
}

function getBossName(bossId: string): string {
  return BOSS_PROFILES.find(boss => boss.id === bossId)?.name || bossId;
}

function hasDefeatedBoss(state: DailyRunState, bossId: string): boolean {
  const bossName = getBossName(bossId);
  return state.history.some(entry => entry.bossesDefeated?.includes(bossName));
}

function hasFlawlessBoss(state: DailyRunState, bossId: string): boolean {
  const bossName = getBossName(bossId);
  return state.history.some(entry => entry.flawlessBossNames?.includes(bossName));
}

function getDefeatedBossCount(state: DailyRunState): number {
  return new Set(state.history.flatMap(entry => entry.bossesDefeated || [])).size;
}

function withRunLevel(minRunLevel: number, predicate: (state: DailyRunState) => boolean) {
  return (state: DailyRunState) => state.runLevel >= minRunLevel && predicate(state);
}

function unitDefinition({
  contentId,
  name,
  description,
  assetName,
  sourceType = 'achievement',
  sourceId,
  tier,
  classId,
  isEarned,
  progress,
}: {
  contentId: string;
  name: string;
  description: string;
  assetName: string;
  sourceType?: 'achievement' | 'boss';
  sourceId: string;
  tier: MinionTier;
  classId: MinionClass;
  isEarned: (state: DailyRunState) => boolean;
  progress: (state: DailyRunState) => string;
}): RunDiscoveryDefinition {
  const minRunLevel = tier === 'tier3' ? 8 : tier === 'tier2' ? 5 : 1;
  return {
    key: discoveryKey('unit', contentId),
    kind: 'unit',
    contentId,
    name,
    description,
    iconPath: `/assets/minions/${assetName}`,
    sourceType,
    sourceId,
    minRunLevel,
    tier,
    classId,
    isEarned: withRunLevel(minRunLevel, isEarned),
    progress,
  };
}

function spellDefinition({
  contentId,
  name,
  description,
  sourceType = 'achievement',
  sourceId,
  isEarned,
  progress,
}: {
  contentId: string;
  name: string;
  description: string;
  sourceType?: 'achievement' | 'boss';
  sourceId: string;
  isEarned: (state: DailyRunState) => boolean;
  progress: (state: DailyRunState) => string;
}): RunDiscoveryDefinition {
  return {
    key: discoveryKey('spell', contentId),
    kind: 'spell',
    contentId,
    name,
    description,
    iconPath: getSpellIconPath({ id: contentId }),
    sourceType,
    sourceId,
    isEarned,
    progress,
  };
}

const maxOmens = (state: DailyRunState) => maxHistoryValue(state, entry => entry.omens?.length || 0);
const maxWins = (state: DailyRunState) => maxHistoryValue(state, entry => entry.wins);
const maxStanding = (state: DailyRunState) => maxHistoryValue(state, entry => entry.unitsStanding);
const maxTemporarySpells = (state: DailyRunState) => maxHistoryValue(state, entry => entry.temporarySpellIds?.length || 0);
const maxHealing = (state: DailyRunState) => maxHistoryValue(state, entry => entry.healingDone || 0);

export const RUN_DISCOVERY_CATALOG: RunDiscoveryDefinition[] = [
  spellDefinition({ contentId: 'thorn-ward', name: 'Thorn Ward', description: 'Clear a run with a templar-class unit.', sourceId: 'clear-templar', isEarned: state => hasClearWithClass(state, 'templar'), progress: state => hasClearWithClass(state, 'templar') ? 'Cleared' : 'Templar clear required' }),
  spellDefinition({ contentId: 'withering-curse', name: 'Withering Curse', description: 'Choose three omens in one run.', sourceId: 'three-omens', isEarned: state => maxOmens(state) >= 3, progress: state => `${Math.min(3, maxOmens(state))}/3 omens` }),
  spellDefinition({ contentId: 'rallying-hymn', name: 'Rallying Hymn', description: 'Clear a run with seven units standing.', sourceId: 'seven-standing', isEarned: state => state.history.some(entry => isFullClear(entry) && entry.unitsStanding >= 7), progress: state => `${Math.min(7, maxStanding(state))}/7 standing` }),
  spellDefinition({ contentId: 'chain-spark', name: 'Chain Spark', description: 'Win five battles in one run.', sourceId: 'five-wins', isEarned: state => maxWins(state) >= 5, progress: state => `${Math.min(5, maxWins(state))}/5 wins` }),
  spellDefinition({ contentId: 'gravity-snare', name: 'Gravity Snare', description: 'Clear a hard route branch.', sourceId: 'hard-route-clear', isEarned: hasHardRouteClear, progress: state => hasHardRouteClear(state) ? 'Cleared' : 'Hard route required' }),
  spellDefinition({ contentId: 'ashen-step', name: 'Ashen Step', description: 'Clear a run without buying from a shop.', sourceId: 'no-shop-clear', isEarned: hasNoShopClear, progress: state => hasNoShopClear(state) ? 'Cleared' : 'No-shop clear required' }),
  spellDefinition({ contentId: 'judgement', name: 'Judgement', description: 'Defeat any run boss.', sourceType: 'boss', sourceId: 'first-boss', isEarned: state => getDefeatedBossCount(state) >= 1, progress: state => `${Math.min(1, getDefeatedBossCount(state))}/1 boss` }),
  spellDefinition({ contentId: 'royal-command', name: 'Royal Command', description: 'Clear five runs.', sourceId: 'five-clears', isEarned: state => state.completions >= 5, progress: state => `${Math.min(5, state.completions)}/5 clears` }),
  spellDefinition({ contentId: 'moonlit-veil', name: 'Moonlit Veil', description: 'Win a battle without the commander taking damage.', sourceId: 'untouched-commander', isEarned: state => state.history.some(entry => (entry.commanderUntouchedBattles || 0) > 0), progress: state => state.history.some(entry => (entry.commanderUntouchedBattles || 0) > 0) ? 'Completed' : 'Untouched win required' }),
  spellDefinition({ contentId: 'blood-star', name: 'Blood Star', description: 'Defeat Scarlet Matron Yvane.', sourceType: 'boss', sourceId: 'scarlet-matron-yvane', isEarned: state => hasDefeatedBoss(state, 'scarlet-matron-yvane'), progress: state => hasDefeatedBoss(state, 'scarlet-matron-yvane') ? 'Defeated' : 'Boss undefeated' }),
  spellDefinition({ contentId: 'iron-benediction', name: 'Iron Benediction', description: 'Clear a run without losing a unit.', sourceId: 'no-loss-clear', isEarned: hasNoLossClear, progress: state => hasNoLossClear(state) ? 'Cleared' : 'No-loss clear required' }),
  spellDefinition({ contentId: 'soul-tether', name: 'Soul Tether', description: 'Restore 250 health in one run.', sourceId: 'heal-250', isEarned: state => maxHealing(state) >= 250, progress: state => `${Math.min(250, maxHealing(state))}/250 healed` }),
  spellDefinition({ contentId: 'frost-lance', name: 'Frost Lance', description: 'Defeat Mother Cindervein.', sourceType: 'boss', sourceId: 'mother-cindervein', isEarned: state => hasDefeatedBoss(state, 'mother-cindervein'), progress: state => hasDefeatedBoss(state, 'mother-cindervein') ? 'Defeated' : 'Boss undefeated' }),
  spellDefinition({ contentId: 'eclipse-nova', name: 'Eclipse Nova', description: 'Defeat Emperor Grave-Aurel.', sourceType: 'boss', sourceId: 'emperor-grave-aurel', isEarned: state => hasDefeatedBoss(state, 'emperor-grave-aurel'), progress: state => hasDefeatedBoss(state, 'emperor-grave-aurel') ? 'Defeated' : 'Boss undefeated' }),
  spellDefinition({ contentId: 'saint-king-aegis', name: 'Saint-King Aegis', description: 'Defeat Key-Saint Ardan.', sourceType: 'boss', sourceId: 'key-saint-ardan', isEarned: state => hasDefeatedBoss(state, 'key-saint-ardan'), progress: state => hasDefeatedBoss(state, 'key-saint-ardan') ? 'Defeated' : 'Boss undefeated' }),
  spellDefinition({ contentId: 'time-crown-edict', name: 'Time-Crown Edict', description: 'Defeat all eight run bosses.', sourceType: 'boss', sourceId: 'all-eight-bosses', isEarned: state => getDefeatedBossCount(state) >= BOSS_PROFILES.length, progress: state => `${Math.min(BOSS_PROFILES.length, getDefeatedBossCount(state))}/${BOSS_PROFILES.length} bosses` }),

  unitDefinition({ contentId: 'witchdoc', name: 'Witch Doctor', description: 'Choose three omens in one run.', assetName: 'witchdoc.png', sourceId: 'three-omens', tier: 'tier1', classId: 'wizard', isEarned: state => maxOmens(state) >= 3, progress: state => `${Math.min(3, maxOmens(state))}/3 omens` }),
  unitDefinition({ contentId: 'crossbow', name: 'Crossbowman', description: 'Win five battles in one run.', assetName: 'crossbow.png', sourceId: 'five-wins', tier: 'tier1', classId: 'knight', isEarned: state => maxWins(state) >= 5, progress: state => `${Math.min(5, maxWins(state))}/5 wins` }),
  unitDefinition({ contentId: 'thief', name: 'Road Thief', description: 'Clear a hard route branch.', assetName: 'thief.png', sourceId: 'hard-route-clear', tier: 'tier1', classId: 'knight', isEarned: hasHardRouteClear, progress: state => hasHardRouteClear(state) ? 'Cleared' : 'Hard route required' }),
  unitDefinition({ contentId: 'darkpriest', name: 'Dark Priest', description: 'Clear after the commander falls below 20% health.', assetName: 'darkpriest.png', sourceId: 'commander-below-20', tier: 'tier1', classId: 'priest', isEarned: state => state.history.some(entry => isFullClear(entry) && (entry.lowestCommanderHealthRatio ?? 1) <= 0.2), progress: state => state.history.some(entry => isFullClear(entry) && (entry.lowestCommanderHealthRatio ?? 1) <= 0.2) ? 'Cleared' : 'Low-health clear required' }),
  unitDefinition({ contentId: 'wizard-magus', name: 'Battle Magus', description: 'Clear a run with a wizard-class unit.', assetName: 'wizard-magus.png', sourceId: 'clear-wizard', tier: 'tier2', classId: 'wizard', isEarned: state => hasClearWithClass(state, 'wizard'), progress: state => state.runLevel < 5 ? `Lv ${state.runLevel}/5` : hasClearWithClass(state, 'wizard') ? 'Cleared' : 'Wizard clear required' }),
  unitDefinition({ contentId: 'enchanter', name: 'Void Enchanter', description: 'Learn four temporary spells in one run.', assetName: 'enchanter.png', sourceId: 'four-temporary-spells', tier: 'tier2', classId: 'wizard', isEarned: state => maxTemporarySpells(state) >= 4, progress: state => state.runLevel < 5 ? `Lv ${state.runLevel}/5` : `${Math.min(4, maxTemporarySpells(state))}/4 spells` }),
  unitDefinition({ contentId: 'knight-man-at-arms', name: 'Man-at-Arms', description: 'Clear with seven units standing.', assetName: 'knight-man-at-arms.png', sourceId: 'seven-standing', tier: 'tier2', classId: 'knight', isEarned: state => state.history.some(entry => isFullClear(entry) && entry.unitsStanding >= 7), progress: state => state.runLevel < 5 ? `Lv ${state.runLevel}/5` : `${Math.min(7, maxStanding(state))}/7 standing` }),
  unitDefinition({ contentId: 'firelord', name: 'Firelord', description: 'Defeat Mother Cindervein.', assetName: 'firelord.png', sourceType: 'boss', sourceId: 'mother-cindervein', tier: 'tier2', classId: 'knight', isEarned: state => hasDefeatedBoss(state, 'mother-cindervein'), progress: state => state.runLevel < 5 ? `Lv ${state.runLevel}/5` : hasDefeatedBoss(state, 'mother-cindervein') ? 'Defeated' : 'Boss undefeated' }),
  unitDefinition({ contentId: 'archer', name: 'Road Archer', description: 'Clear a run without buying from a shop.', assetName: 'archer.png', sourceId: 'no-shop-clear', tier: 'tier2', classId: 'knight', isEarned: hasNoShopClear, progress: state => state.runLevel < 5 ? `Lv ${state.runLevel}/5` : hasNoShopClear(state) ? 'Cleared' : 'No-shop clear required' }),
  unitDefinition({ contentId: 'templar-crusader', name: 'Crusader', description: 'Clear a run with a templar-class unit.', assetName: 'templar-crusader.png', sourceId: 'clear-templar', tier: 'tier2', classId: 'templar', isEarned: state => hasClearWithClass(state, 'templar'), progress: state => state.runLevel < 5 ? `Lv ${state.runLevel}/5` : hasClearWithClass(state, 'templar') ? 'Cleared' : 'Templar clear required' }),
  unitDefinition({ contentId: 'bell', name: 'Bell Warden', description: 'Clear a run without losing a unit.', assetName: 'bell.png', sourceId: 'no-loss-clear', tier: 'tier2', classId: 'templar', isEarned: hasNoLossClear, progress: state => state.runLevel < 5 ? `Lv ${state.runLevel}/5` : hasNoLossClear(state) ? 'Cleared' : 'No-loss clear required' }),
  unitDefinition({ contentId: 'priest-cleric', name: 'Cleric', description: 'Restore 250 health in one run.', assetName: 'priest-cleric.png', sourceId: 'heal-250', tier: 'tier2', classId: 'priest', isEarned: state => maxHealing(state) >= 250, progress: state => state.runLevel < 5 ? `Lv ${state.runLevel}/5` : `${Math.min(250, maxHealing(state))}/250 healed` }),
  unitDefinition({ contentId: 'wizard-archmage', name: 'Archmage', description: 'Defeat Lady Mirror Veyra.', assetName: 'wizard-archmage.png', sourceType: 'boss', sourceId: 'lady-mirror-veyra', tier: 'tier3', classId: 'wizard', isEarned: state => hasDefeatedBoss(state, 'lady-mirror-veyra'), progress: state => state.runLevel < 8 ? `Lv ${state.runLevel}/8` : hasDefeatedBoss(state, 'lady-mirror-veyra') ? 'Defeated' : 'Boss undefeated' }),
  unitDefinition({ contentId: 'plaugedoc', name: 'Plague Doctor', description: 'Defeat Blackroot Vessel.', assetName: 'plaugedoc.png', sourceType: 'boss', sourceId: 'blackroot-vessel', tier: 'tier3', classId: 'wizard', isEarned: state => hasDefeatedBoss(state, 'blackroot-vessel'), progress: state => state.runLevel < 8 ? `Lv ${state.runLevel}/8` : hasDefeatedBoss(state, 'blackroot-vessel') ? 'Defeated' : 'Boss undefeated' }),
  unitDefinition({ contentId: 'knight-champion', name: 'Champion Knight', description: 'Defeat Ser Kael Duskplate.', assetName: 'knight-champion.png', sourceType: 'boss', sourceId: 'ser-kael-duskplate', tier: 'tier3', classId: 'knight', isEarned: state => hasDefeatedBoss(state, 'ser-kael-duskplate'), progress: state => state.runLevel < 8 ? `Lv ${state.runLevel}/8` : hasDefeatedBoss(state, 'ser-kael-duskplate') ? 'Defeated' : 'Boss undefeated' }),
  unitDefinition({ contentId: 'fallen', name: 'Fallen Wing Knight', description: 'Defeat Key-Saint Ardan.', assetName: 'fallen.png', sourceType: 'boss', sourceId: 'key-saint-ardan', tier: 'tier3', classId: 'knight', isEarned: state => hasDefeatedBoss(state, 'key-saint-ardan'), progress: state => state.runLevel < 8 ? `Lv ${state.runLevel}/8` : hasDefeatedBoss(state, 'key-saint-ardan') ? 'Defeated' : 'Boss undefeated' }),
  unitDefinition({ contentId: 'mercenary', name: 'Grave Mercenary', description: 'Defeat Emperor Grave-Aurel.', assetName: 'mercenary.png', sourceType: 'boss', sourceId: 'emperor-grave-aurel', tier: 'tier3', classId: 'knight', isEarned: state => hasDefeatedBoss(state, 'emperor-grave-aurel'), progress: state => state.runLevel < 8 ? `Lv ${state.runLevel}/8` : hasDefeatedBoss(state, 'emperor-grave-aurel') ? 'Defeated' : 'Boss undefeated' }),
  unitDefinition({ contentId: 'crow', name: 'Crowblade Assassin', description: 'Defeat Scarlet Matron Yvane.', assetName: 'crow.png', sourceType: 'boss', sourceId: 'scarlet-matron-yvane', tier: 'tier3', classId: 'knight', isEarned: state => hasDefeatedBoss(state, 'scarlet-matron-yvane'), progress: state => state.runLevel < 8 ? `Lv ${state.runLevel}/8` : hasDefeatedBoss(state, 'scarlet-matron-yvane') ? 'Defeated' : 'Boss undefeated' }),
  unitDefinition({ contentId: 'templar-paragon', name: 'Templar Paragon', description: 'Defeat Mother Cindervein under a challenge modifier.', assetName: 'templar-paragon.png', sourceType: 'boss', sourceId: 'mother-cindervein-challenge', tier: 'tier3', classId: 'templar', isEarned: state => state.history.some(entry => Boolean(entry.challengeModifierIds?.length) && entry.bossesDefeated?.includes(getBossName('mother-cindervein'))), progress: state => state.runLevel < 8 ? `Lv ${state.runLevel}/8` : state.history.some(entry => Boolean(entry.challengeModifierIds?.length) && entry.bossesDefeated?.includes(getBossName('mother-cindervein'))) ? 'Defeated' : 'Challenge clear required' }),
  unitDefinition({ contentId: 'priest-high-priest', name: 'High Priest', description: 'Defeat Prior Moon Voss without losing a deployed unit.', assetName: 'priest-high-priest.png', sourceType: 'boss', sourceId: 'prior-moon-voss-flawless', tier: 'tier3', classId: 'priest', isEarned: state => hasFlawlessBoss(state, 'prior-moon-voss'), progress: state => state.runLevel < 8 ? `Lv ${state.runLevel}/8` : hasFlawlessBoss(state, 'prior-moon-voss') ? 'Flawless' : 'Flawless boss win required' }),
];

function isValidContent(kind: RunDiscoveryKind, contentId: string): boolean {
  return kind === 'spell'
    ? (ALL_RUN_SPELL_IDS as readonly string[]).includes(contentId)
    : (ALL_RUN_UNIT_TEMPLATE_IDS as readonly string[]).includes(contentId);
}

function makeUnlockRecord(
  kind: RunDiscoveryKind,
  contentId: string,
  sourceType: RunDiscoverySourceType,
  sourceId: string,
  unlockedAt: number,
): RunDiscoveryUnlockRecord {
  return {
    id: discoveryKey(kind, contentId),
    kind,
    contentId,
    sourceType,
    sourceId,
    unlockedAt: Math.max(1, Math.floor(unlockedAt || 1)),
  };
}

export function normalizeRunDiscoveryState(
  state: Partial<RunDiscoveryState> | null | undefined,
  legacySpellIds: readonly string[] = [],
  history: readonly DailyRunHistoryEntry[] = [],
): RunDiscoveryState {
  const migrated = Number(state?.version || 0) >= RUN_DISCOVERY_VERSION;
  const starterSpells = [...RUN_STARTER_SPELL_IDS];
  const starterUnits = [...RUN_STARTER_UNIT_TEMPLATE_IDS];
  const legacySpells = migrated ? [] : legacySpellIds.filter(id => isValidContent('spell', id));
  const legacyUnits = migrated
    ? []
    : history.flatMap(entry => entry.unitTemplateIds || []).filter(id => isValidContent('unit', id));
  const unlockedSpellIds = Array.from(new Set([
    ...starterSpells,
    ...(state?.unlockedSpellIds || []).filter(id => isValidContent('spell', id)),
    ...legacySpells,
  ]));
  const unlockedUnitTemplateIds = Array.from(new Set([
    ...starterUnits,
    ...(state?.unlockedUnitTemplateIds || []).filter(id => isValidContent('unit', id)),
    ...legacyUnits,
  ]));
  const validUnlockedKeys = new Set([
    ...unlockedSpellIds.map(id => discoveryKey('spell', id)),
    ...unlockedUnitTemplateIds.map(id => discoveryKey('unit', id)),
  ]);
  const recordsById = new Map<string, RunDiscoveryUnlockRecord>();

  (state?.unlockRecords || []).forEach(record => {
    if (!record || !isValidContent(record.kind, record.contentId)) return;
    const id = discoveryKey(record.kind, record.contentId);
    if (!validUnlockedKeys.has(id)) return;
    recordsById.set(id, {
      ...record,
      id,
      unlockedAt: Math.max(1, Math.floor(Number(record.unlockedAt) || 1)),
    });
  });

  const ensureRecord = (kind: RunDiscoveryKind, contentId: string, sourceType: RunDiscoverySourceType) => {
    const id = discoveryKey(kind, contentId);
    if (recordsById.has(id)) return;
    recordsById.set(id, makeUnlockRecord(
      kind,
      contentId,
      sourceType,
      sourceType === 'starter' ? 'core-run-pool' : 'pre-discovery-save',
      1,
    ));
  };

  unlockedSpellIds.forEach(id => ensureRecord('spell', id, (RUN_STARTER_SPELL_IDS as readonly string[]).includes(id) ? 'starter' : 'legacy'));
  unlockedUnitTemplateIds.forEach(id => ensureRecord('unit', id, (RUN_STARTER_UNIT_TEMPLATE_IDS as readonly string[]).includes(id) ? 'starter' : 'legacy'));

  const pendingById = new Map<string, RunDiscoveryPendingOffer>();
  (state?.pendingOffers || []).forEach(offer => {
    if (!offer || !isValidContent(offer.kind, offer.contentId)) return;
    const id = discoveryKey(offer.kind, offer.contentId);
    if (!validUnlockedKeys.has(id)) return;
    pendingById.set(id, {
      id,
      kind: offer.kind,
      contentId: offer.contentId,
      offerNodesRemaining: Math.max(1, Math.min(RUN_DISCOVERY_OFFER_WINDOW, Math.floor(offer.offerNodesRemaining || RUN_DISCOVERY_OFFER_WINDOW))),
      unlockedAt: Math.max(1, Math.floor(Number(offer.unlockedAt) || 1)),
    });
  });

  return {
    version: RUN_DISCOVERY_VERSION,
    unlockedSpellIds,
    unlockedUnitTemplateIds,
    unlockRecords: Array.from(recordsById.values()).sort((left, right) => left.unlockedAt - right.unlockedAt || left.id.localeCompare(right.id)),
    pendingOffers: Array.from(pendingById.values()).sort((left, right) => left.unlockedAt - right.unlockedAt || left.id.localeCompare(right.id)),
  };
}

export function syncRunDiscoveryState(
  state: DailyRunState,
  legacySpellIds: readonly string[] = [],
  unlockedAt = Date.now(),
): RunDiscoveryState {
  const discovery = normalizeRunDiscoveryState(state.discovery, legacySpellIds, state.history);
  const spellIds = new Set(discovery.unlockedSpellIds);
  const unitIds = new Set(discovery.unlockedUnitTemplateIds);
  const records = new Map(discovery.unlockRecords.map(record => [record.id, record]));
  const pending = new Map(discovery.pendingOffers.map(offer => [offer.id, offer]));

  RUN_DISCOVERY_CATALOG.forEach(definition => {
    const unlocked = definition.kind === 'spell'
      ? spellIds.has(definition.contentId)
      : unitIds.has(definition.contentId);
    if (unlocked || !definition.isEarned(state)) return;

    if (definition.kind === 'spell') spellIds.add(definition.contentId);
    else unitIds.add(definition.contentId);
    records.set(definition.key, makeUnlockRecord(
      definition.kind,
      definition.contentId,
      definition.sourceType,
      definition.sourceId,
      unlockedAt,
    ));
    pending.set(definition.key, {
      id: definition.key,
      kind: definition.kind,
      contentId: definition.contentId,
      offerNodesRemaining: RUN_DISCOVERY_OFFER_WINDOW,
      unlockedAt: Math.max(1, Math.floor(unlockedAt || 1)),
    });
  });

  const seenOfferIds = new Set(state.history.flatMap(entry => entry.discoveryOfferIdsSeen || []));
  seenOfferIds.forEach(id => pending.delete(id));

  return normalizeRunDiscoveryState({
    version: RUN_DISCOVERY_VERSION,
    unlockedSpellIds: Array.from(spellIds),
    unlockedUnitTemplateIds: Array.from(unitIds),
    unlockRecords: Array.from(records.values()),
    pendingOffers: Array.from(pending.values()),
  });
}

export function getRunDiscoveryViews(state: DailyRunState, kind?: RunDiscoveryKind): RunDiscoveryView[] {
  const discovery = normalizeRunDiscoveryState(state.discovery, [], state.history);
  const unlocked = new Set([
    ...discovery.unlockedSpellIds.map(id => discoveryKey('spell', id)),
    ...discovery.unlockedUnitTemplateIds.map(id => discoveryKey('unit', id)),
  ]);
  const records = new Map(discovery.unlockRecords.map(record => [record.id, record]));
  const pending = new Set(discovery.pendingOffers.map(offer => offer.id));

  return RUN_DISCOVERY_CATALOG
    .filter(definition => !kind || definition.kind === kind)
    .map(definition => ({
      ...definition,
      unlocked: unlocked.has(definition.key),
      unlockedAt: records.get(definition.key)?.unlockedAt,
      pendingOffer: pending.has(definition.key),
      progressLabel: definition.progress(state),
    }));
}

export function getRunDiscoveryOfferKey(kind: RunDiscoveryKind, contentId: string): string {
  return discoveryKey(kind, contentId);
}

export function isRunContentUnlocked(
  discovery: RunDiscoveryState,
  kind: RunDiscoveryKind,
  contentId: string,
): boolean {
  return kind === 'spell'
    ? discovery.unlockedSpellIds.includes(contentId)
    : discovery.unlockedUnitTemplateIds.includes(contentId);
}
