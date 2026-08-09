import { BOSS_PROFILES } from '@/lib/bosses';
import type {
  DailyRunState,
  EquipmentRarity,
  MinionClass,
  RunMilestoneTier,
  RunMilestoneUnlockRecord,
} from '@/lib/auth';

export type RunMilestoneCategory = 'boss' | 'road' | 'army' | 'spell' | 'meta' | 'economy';
export const RUN_MILESTONE_CATEGORY_LABELS: Record<RunMilestoneCategory, string> = {
  boss: 'Boss Trophies',
  road: 'Route Feats',
  army: 'Unit Gallery',
  spell: 'Spell Unlocks',
  meta: 'Run Meta',
  economy: 'Run Economy',
};

export interface RunMilestoneDefinition {
  id: string;
  category: RunMilestoneCategory;
  title: string;
  description: string;
  iconPath: string;
  tier: RunMilestoneTier;
  rewardHint?: string;
  claimReward?: string;
}

export interface RunMilestoneView extends RunMilestoneDefinition {
  unlocked: boolean;
  unlockedAt?: number;
  progressLabel?: string;
}

export interface RunMilestoneCategorySummary {
  category: RunMilestoneCategory;
  label: string;
  iconPath: string;
  unlocked: number;
  total: number;
}

const CATEGORY_FEATURE_ICONS: Record<RunMilestoneCategory, string> = {
  boss: '/assets/bosses/boss1.png',
  road: '/assets/icons/speed.png',
  army: '/assets/minions/templar-initiate.png',
  spell: '/assets/spells/arcane-bolt.png',
  meta: '/assets/icons/xp.png',
  economy: '/assets/icons/gold.png',
};

function getDefeatedBossNames(state: DailyRunState): Set<string> {
  const names = new Set<string>();
  state.history.forEach(entry => {
    entry.bossesDefeated?.forEach(name => names.add(name));
  });
  return names;
}

function getUnlockedSpellNames(state: DailyRunState): Set<string> {
  const names = new Set<string>();
  state.history.forEach(entry => {
    entry.unlockedSpellNames?.forEach(name => names.add(name));
  });
  return names;
}

function discoveryHasSpell(state: DailyRunState, spellId: string): boolean {
  return Boolean(state.discovery?.unlockedSpellIds?.includes(spellId));
}

function historyHasRouteKeyword(state: DailyRunState, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  return state.history.some(entry =>
    entry.routeSummary?.some(step => step.toLowerCase().includes(needle))
  );
}

function historyHasShopBuy(state: DailyRunState): boolean {
  return state.history.some(entry => (entry.shopBuys?.length || 0) > 0);
}

function historyHasOmen(state: DailyRunState): boolean {
  return state.history.some(entry => (entry.omens?.length || 0) > 0);
}

function maxShopBuysInRun(state: DailyRunState): number {
  return Math.max(0, ...state.history.map(entry => entry.shopBuys?.length || 0));
}

function maxShopGoldSpentInRun(state: DailyRunState): number {
  return Math.max(0, ...state.history.map(entry => entry.shopGoldSpent || 0));
}

function hasFullClearWithoutShop(state: DailyRunState): boolean {
  return state.history.some(entry =>
    entry.wins >= entry.targetBattles && (entry.shopBuys?.length || 0) === 0
  );
}

function hasFlawlessBossClear(state: DailyRunState): boolean {
  return state.history.some(entry => (entry.flawlessBossNames?.length || 0) > 0);
}

function hasFastBossClear(state: DailyRunState): boolean {
  return state.history.some(entry => (entry.fastBossNames?.length || 0) > 0);
}

function maxOmensInRun(state: DailyRunState): number {
  return Math.max(0, ...state.history.map(entry => entry.omens?.length || 0));
}

function historyHasUnitClass(state: DailyRunState, classId: MinionClass): boolean {
  return state.history.some(entry => entry.unitClassIds?.includes(classId));
}

function historyHasTierThreeUnit(state: DailyRunState): boolean {
  return state.history.some(entry => (entry.tierThreeUnitNames?.length || 0) > 0);
}

const BOSS_MILESTONES: RunMilestoneDefinition[] = BOSS_PROFILES.map(boss => ({
  id: `boss-${boss.id}`,
  category: 'boss' as const,
  title: `${boss.name} Trophy`,
  description: `Defeat ${boss.name} on a run.`,
  iconPath: boss.assetPath,
  tier: 'gold',
}));

const STATIC_MILESTONE_BASE: Array<Omit<RunMilestoneDefinition, 'tier'>> = [
  {
    id: 'road-first-clear',
    category: 'road',
    title: 'Roadbreaker',
    description: 'Clear any run road.',
    iconPath: '/assets/icons/loot-chest.png',
  },
  {
    id: 'road-five-wins',
    category: 'road',
    title: 'Long March',
    description: 'Finish a run with at least five battle wins.',
    iconPath: '/assets/icons/attack.png',
  },
  {
    id: 'road-hard-route',
    category: 'road',
    title: 'Hard Road',
    description: 'Clear a run that used a hard route branch.',
    iconPath: '/assets/icons/speed.png',
  },
  {
    id: 'road-double-boss',
    category: 'road',
    title: 'Twin Graves',
    description: 'Defeat two bosses in one run.',
    iconPath: '/assets/icons/attack.png',
  },
  {
    id: 'road-full-warband',
    category: 'road',
    title: 'No Empty Graves',
    description: 'Clear a run with seven units still standing.',
    iconPath: '/assets/icons/defense.png',
  },
  {
    id: 'road-no-shop-clear',
    category: 'road',
    title: 'Empty Purse March',
    description: 'Clear a full run without buying from a shop.',
    iconPath: '/assets/icons/gold.png',
  },
  {
    id: 'boss-flawless-clear',
    category: 'boss',
    title: 'Untouched Vanguard',
    description: 'Defeat a run boss with every deployed unit still standing.',
    iconPath: '/assets/icons/defense.png',
  },
  {
    id: 'boss-speed-clear',
    category: 'boss',
    title: 'Ninety-Second Sentence',
    description: 'Defeat a run boss in 90 seconds or less.',
    iconPath: '/assets/icons/speed.png',
  },
  {
    id: 'army-priest-recruit',
    category: 'army',
    title: 'Faithful Recruit',
    description: 'Add a priest-class minion to a run warband.',
    iconPath: '/assets/minions/priest-cleric.png',
    rewardHint: 'Future: priest milestone rewards.',
  },
  {
    id: 'army-knight-recruit',
    category: 'army',
    title: 'Shield Oath',
    description: 'Field a knight-class minion in a cleared run.',
    iconPath: '/assets/minions/knight-man-at-arms.png',
  },
  {
    id: 'army-wizard-recruit',
    category: 'army',
    title: 'Arcane Pact',
    description: 'Field a wizard-class minion in a cleared run.',
    iconPath: '/assets/minions/wizard-magus.png',
  },
  {
    id: 'army-templar-recruit',
    category: 'army',
    title: 'Templar Vow',
    description: 'Field a templar-class minion in a run.',
    iconPath: '/assets/minions/templar-initiate.png',
  },
  {
    id: 'army-tier-three-recruit',
    category: 'army',
    title: 'Elite Contract',
    description: 'Recruit or finish with any tier III unit in a run.',
    iconPath: '/assets/minions/knight-champion.png',
  },
  {
    id: 'spell-arcane-bolt',
    category: 'spell',
    title: 'Judgement',
    description: 'Permanently unlock Judgement by defeating any run boss.',
    iconPath: '/assets/spells/judgement.png',
    rewardHint: 'Discovery spell milestone.',
  },
  {
    id: 'spell-frost-lance',
    category: 'spell',
    title: 'Frost Lance',
    description: 'Permanently unlock Frost Lance by defeating Mother Cindervein.',
    iconPath: '/assets/spells/frost-lance.png',
    rewardHint: 'Discovery spell milestone.',
  },
  {
    id: 'spell-sanctified-mend',
    category: 'spell',
    title: 'Iron Benediction',
    description: 'Permanently unlock Iron Benediction by clearing a run without losing a unit.',
    iconPath: '/assets/spells/iron-benediction.png',
    rewardHint: 'Discovery spell milestone.',
  },
  {
    id: 'spell-blood-star',
    category: 'spell',
    title: 'Blood Star',
    description: 'Permanently unlock Blood Star by defeating Scarlet Matron Yvane.',
    iconPath: '/assets/spells/blood-star.png',
    rewardHint: 'Discovery spell milestone.',
  },
  {
    id: 'meta-run-level-3',
    category: 'meta',
    title: 'Relic Seeker',
    description: 'Reach run level 3.',
    iconPath: '/assets/icons/loot-chest.png',
    claimReward: 'Rare commander gear can appear in future singleplayer runs.',
  },
  {
    id: 'meta-run-level-5',
    category: 'meta',
    title: 'Veteran Runner',
    description: 'Reach run level 5.',
    iconPath: '/assets/icons/xp.png',
    claimReward: 'Epic commander gear can appear in future singleplayer runs.',
  },
  {
    id: 'meta-run-level-10',
    category: 'meta',
    title: 'Road Legend',
    description: 'Reach run level 10.',
    iconPath: '/assets/icons/xp.png',
    claimReward: 'Legendary commander gear can appear in future singleplayer runs.',
  },
  {
    id: 'meta-run-level-15',
    category: 'meta',
    title: 'Crown Road',
    description: 'Reach the current run level cap.',
    iconPath: '/assets/icons/xp.png',
  },
  {
    id: 'meta-ten-clears',
    category: 'meta',
    title: 'Decade of Roads',
    description: 'Clear ten runs.',
    iconPath: '/assets/icons/loot-chest.png',
  },
  {
    id: 'meta-streak-5',
    category: 'meta',
    title: 'Winning Streak',
    description: 'Reach a five-run clear streak.',
    iconPath: '/assets/icons/dice.png',
  },
  {
    id: 'economy-shop-buy',
    category: 'economy',
    title: 'Road Merchant',
    description: 'Buy an item from a run shop.',
    iconPath: '/assets/icons/gold.png',
  },
  {
    id: 'economy-three-shop-buys',
    category: 'economy',
    title: 'Quartermaster',
    description: 'Buy three shop offers in one run.',
    iconPath: '/assets/icons/gold.png',
    claimReward: 'Future singleplayer runs begin with one extra shop reroll.',
  },
  {
    id: 'economy-spend-500',
    category: 'economy',
    title: 'Heavy Purse',
    description: 'Spend at least 500 run gold in one run.',
    iconPath: '/assets/icons/gold.png',
  },
  {
    id: 'economy-omen',
    category: 'economy',
    title: 'Omen Touched',
    description: 'Resolve an omen on a run.',
    iconPath: '/assets/icons/rare-gem.png',
  },
  {
    id: 'economy-five-omens',
    category: 'economy',
    title: 'Star Reader',
    description: 'Resolve five omens in one run.',
    iconPath: '/assets/icons/rare-gem.png',
    claimReward: 'Future singleplayer runs begin with one extra omen reroll.',
  },
];

function getStaticMilestoneTier(milestone: Omit<RunMilestoneDefinition, 'tier'>): RunMilestoneTier {
  if (milestone.id === 'meta-run-level-15') return 'legendary';
  if (
    milestone.id === 'meta-run-level-10'
    || milestone.id === 'meta-ten-clears'
    || milestone.id === 'road-double-boss'
    || milestone.id === 'boss-flawless-clear'
    || milestone.id === 'boss-speed-clear'
    || milestone.id === 'economy-spend-500'
  ) return 'gold';
  if (
    milestone.category === 'army'
    || milestone.category === 'spell'
    || milestone.id === 'meta-run-level-5'
    || milestone.id === 'meta-streak-5'
    || milestone.id === 'economy-three-shop-buys'
    || milestone.id === 'economy-five-omens'
  ) return 'silver';
  return 'bronze';
}

const STATIC_MILESTONES: RunMilestoneDefinition[] = STATIC_MILESTONE_BASE.map(milestone => ({
  ...milestone,
  tier: getStaticMilestoneTier(milestone),
}));

export const RUN_MILESTONE_CATALOG: RunMilestoneDefinition[] = [
  ...BOSS_MILESTONES,
  ...STATIC_MILESTONES,
];

function getStoredMilestoneRecord(
  state: DailyRunState,
  milestoneId: string,
): RunMilestoneUnlockRecord | undefined {
  return state.milestoneUnlocks?.find(record => record.id === milestoneId);
}

function isMilestoneUnlocked(state: DailyRunState, milestone: RunMilestoneDefinition): boolean {
  const defeatedBosses = getDefeatedBossNames(state);
  const unlockedSpells = getUnlockedSpellNames(state);

  switch (milestone.id) {
    case 'road-first-clear':
      return state.completions > 0;
    case 'road-five-wins':
      return state.history.some(entry => entry.wins >= 5);
    case 'road-hard-route':
      return historyHasRouteKeyword(state, 'hard');
    case 'road-double-boss':
      return state.history.some(entry => (entry.bossesDefeated?.length || 0) >= 2);
    case 'road-full-warband':
      return state.history.some(entry => entry.wins >= entry.targetBattles && entry.unitsStanding >= 7);
    case 'road-no-shop-clear':
      return hasFullClearWithoutShop(state);
    case 'boss-flawless-clear':
      return hasFlawlessBossClear(state);
    case 'boss-speed-clear':
      return hasFastBossClear(state);
    case 'army-priest-recruit':
      return historyHasUnitClass(state, 'priest');
    case 'army-knight-recruit':
      return historyHasUnitClass(state, 'knight');
    case 'army-wizard-recruit':
      return historyHasUnitClass(state, 'wizard');
    case 'army-templar-recruit':
      return historyHasUnitClass(state, 'templar');
    case 'army-tier-three-recruit':
      return historyHasTierThreeUnit(state);
    case 'spell-arcane-bolt':
      return discoveryHasSpell(state, 'judgement') || unlockedSpells.has('Judgement') || unlockedSpells.has('Arcane Bolt');
    case 'spell-frost-lance':
      return discoveryHasSpell(state, 'frost-lance') || unlockedSpells.has('Frost Lance');
    case 'spell-sanctified-mend':
      return discoveryHasSpell(state, 'iron-benediction') || unlockedSpells.has('Iron Benediction') || unlockedSpells.has('Sanctified Mend');
    case 'spell-blood-star':
      return discoveryHasSpell(state, 'blood-star') || unlockedSpells.has('Blood Star');
    case 'meta-run-level-3':
      return state.runLevel >= 3;
    case 'meta-run-level-5':
      return state.runLevel >= 5;
    case 'meta-run-level-10':
      return state.runLevel >= 10;
    case 'meta-run-level-15':
      return state.runLevel >= 15;
    case 'meta-ten-clears':
      return state.completions >= 10;
    case 'meta-streak-5':
      return state.streak >= 5 || state.history.some(entry => entry.streakAfter >= 5);
    case 'economy-shop-buy':
      return historyHasShopBuy(state);
    case 'economy-three-shop-buys':
      return maxShopBuysInRun(state) >= 3;
    case 'economy-spend-500':
      return maxShopGoldSpentInRun(state) >= 500;
    case 'economy-omen':
      return historyHasOmen(state);
    case 'economy-five-omens':
      return maxOmensInRun(state) >= 5;
    default:
      if (milestone.id.startsWith('boss-')) {
        const bossId = milestone.id.replace('boss-', '');
        const boss = BOSS_PROFILES.find(profile => profile.id === bossId);
        return boss ? defeatedBosses.has(boss.name) : false;
      }
      return false;
  }
}

function getRunMilestoneProgressLabel(state: DailyRunState, milestoneId: string): string | undefined {
  if (milestoneId === 'meta-run-level-3') return `Lv ${state.runLevel}/3`;
  if (milestoneId === 'meta-run-level-5') return `Lv ${state.runLevel}/5`;
  if (milestoneId === 'meta-run-level-10') return `Lv ${state.runLevel}/10`;
  if (milestoneId === 'meta-run-level-15') return `Lv ${state.runLevel}/15`;
  if (milestoneId === 'meta-ten-clears') return `${state.completions}/10`;
  if (milestoneId === 'meta-streak-5') return `${state.streak}/5 streak`;
  if (milestoneId === 'economy-three-shop-buys') return `${maxShopBuysInRun(state)}/3 buys`;
  if (milestoneId === 'economy-spend-500') return `${maxShopGoldSpentInRun(state)}/500 gold`;
  if (milestoneId === 'economy-five-omens') return `${maxOmensInRun(state)}/5 omens`;
  if (milestoneId === 'road-double-boss') {
    const maxBosses = Math.max(0, ...state.history.map(entry => entry.bossesDefeated?.length || 0));
    return `${maxBosses}/2 bosses`;
  }
  if (milestoneId === 'road-full-warband') {
    const maxStanding = Math.max(0, ...state.history.map(entry => entry.unitsStanding || 0));
    return `${maxStanding}/7 standing`;
  }
  if (milestoneId === 'road-no-shop-clear') return hasFullClearWithoutShop(state) ? 'Cleared' : 'Not cleared';
  if (milestoneId === 'boss-flawless-clear') return hasFlawlessBossClear(state) ? 'Cleared' : 'No flawless boss';
  if (milestoneId === 'boss-speed-clear') return hasFastBossClear(state) ? 'Cleared' : 'No speed clear';
  return undefined;
}

export function getRunMilestoneViews(state: DailyRunState): RunMilestoneView[] {
  return RUN_MILESTONE_CATALOG.map(milestone => {
    const record = getStoredMilestoneRecord(state, milestone.id);
    return {
      ...milestone,
      unlocked: Boolean(record) || isMilestoneUnlocked(state, milestone),
      unlockedAt: record?.unlockedAt,
      progressLabel: getRunMilestoneProgressLabel(state, milestone.id),
    };
  });
}

export function syncRunMilestoneUnlockRecords(
  state: DailyRunState,
  unlockedAt = Date.now(),
): DailyRunState {
  const safeUnlockedAt = Math.max(1, Math.floor(Number.isFinite(unlockedAt) ? unlockedAt : 1));
  const existingById = new Map((state.milestoneUnlocks || []).map(record => [record.id, record]));
  const milestoneUnlocks = RUN_MILESTONE_CATALOG.flatMap(milestone => {
    const existing = existingById.get(milestone.id);
    if (!existing && !isMilestoneUnlocked(state, milestone)) return [];

    return [{
      id: milestone.id,
      unlockedAt: existing?.unlockedAt && Number.isFinite(existing.unlockedAt)
        ? Math.max(1, Math.floor(existing.unlockedAt))
        : safeUnlockedAt,
      tier: milestone.tier,
      title: milestone.title,
      category: milestone.category,
      iconPath: milestone.iconPath,
    } satisfies RunMilestoneUnlockRecord];
  }).sort((left, right) => right.unlockedAt - left.unlockedAt || left.id.localeCompare(right.id));

  return { ...state, milestoneUnlocks };
}

export function getMilestonesByCategory(state: DailyRunState, category: RunMilestoneCategory): RunMilestoneView[] {
  return getRunMilestoneViews(state).filter(view => view.category === category);
}

export function getRunMilestoneCategorySummaries(state: DailyRunState): RunMilestoneCategorySummary[] {
  const views = getRunMilestoneViews(state);
  const categories: RunMilestoneCategory[] = ['boss', 'road', 'army', 'spell', 'meta', 'economy'];

  return categories.map(category => {
    const inCategory = views.filter(view => view.category === category);
    const unlocked = inCategory.filter(view => view.unlocked).length;
    const featured = inCategory.find(view => view.unlocked) || inCategory[0];

    return {
      category,
      label: RUN_MILESTONE_CATEGORY_LABELS[category],
      iconPath: featured?.iconPath || CATEGORY_FEATURE_ICONS[category],
      unlocked,
      total: inCategory.length,
    };
  });
}

export function getFeaturedHubMilestones(state: DailyRunState, limit = 6): RunMilestoneView[] {
  const views = getRunMilestoneViews(state);
  const priority = ['meta-run-level-3', 'meta-run-level-5', 'meta-run-level-10', 'road-first-clear', 'economy-three-shop-buys', 'economy-five-omens'];
  const picked = priority
    .map(id => views.find(view => view.id === id))
    .filter((view): view is RunMilestoneView => Boolean(view));

  if (picked.length >= limit) return picked.slice(0, limit);

  const remaining = views.filter(view => !picked.some(item => item.id === view.id));
  return [...picked, ...remaining].slice(0, limit);
}

export function getRunMilestoneRewardExp(milestoneId: string): number {
  if (milestoneId.startsWith('boss-')) return 75;
  if (milestoneId.startsWith('meta-')) return 60;
  if (milestoneId.startsWith('spell-')) return 50;
  return 40;
}

export function isRunMilestoneRewardClaimed(state: DailyRunState, milestoneId: string): boolean {
  return (state.claimedMilestoneIds || []).includes(milestoneId);
}

export interface RunProgressionUnlocks {
  maxGearRarity: EquipmentRarity;
  shopRerollBonus: number;
  omenRerollBonus: number;
}

export function getRunProgressionUnlocks(state: DailyRunState): RunProgressionUnlocks {
  const claimed = new Set(state.claimedMilestoneIds || []);
  const maxGearRarity: EquipmentRarity = claimed.has('meta-run-level-10')
    ? 'legendary'
    : claimed.has('meta-run-level-5')
      ? 'epic'
      : claimed.has('meta-run-level-3')
        ? 'rare'
        : 'decent';

  return {
    maxGearRarity,
    shopRerollBonus: claimed.has('economy-three-shop-buys') ? 1 : 0,
    omenRerollBonus: claimed.has('economy-five-omens') ? 1 : 0,
  };
}

export function getRunMilestoneUnlockCounts(state: DailyRunState): { unlocked: number; total: number } {
  const views = getRunMilestoneViews(state);
  return {
    unlocked: views.filter(view => view.unlocked).length,
    total: views.length,
  };
}
