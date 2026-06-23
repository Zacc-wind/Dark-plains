import { BOSS_PROFILES } from '@/lib/bosses';
import type { DailyRunState } from '@/lib/auth';

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
  rewardHint?: string;
}

export interface RunMilestoneView extends RunMilestoneDefinition {
  unlocked: boolean;
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

const BOSS_MILESTONES: RunMilestoneDefinition[] = BOSS_PROFILES.map(boss => ({
  id: `boss-${boss.id}`,
  category: 'boss' as const,
  title: `${boss.name} Trophy`,
  description: `Defeat ${boss.name} on a run.`,
  iconPath: boss.assetPath,
}));

const STATIC_MILESTONES: RunMilestoneDefinition[] = [
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
    id: 'spell-arcane-bolt',
    category: 'spell',
    title: 'Arcane Bolt',
    description: 'Permanently unlock Arcane Bolt from a run reward.',
    iconPath: '/assets/spells/arcane-bolt.png',
    rewardHint: 'Spell unlock milestone.',
  },
  {
    id: 'spell-frost-lance',
    category: 'spell',
    title: 'Frost Lance',
    description: 'Permanently unlock Frost Lance from a run reward.',
    iconPath: '/assets/spells/frost-lance.png',
    rewardHint: 'Spell unlock milestone.',
  },
  {
    id: 'spell-sanctified-mend',
    category: 'spell',
    title: 'Sanctified Mend',
    description: 'Permanently unlock Sanctified Mend from a run reward.',
    iconPath: '/assets/spells/sanctified-mend.png',
    rewardHint: 'Spell unlock milestone.',
  },
  {
    id: 'spell-blood-star',
    category: 'spell',
    title: 'Blood Star',
    description: 'Permanently unlock Blood Star from a run reward.',
    iconPath: '/assets/spells/blood-star.png',
    rewardHint: 'Spell unlock milestone.',
  },
  {
    id: 'meta-run-level-5',
    category: 'meta',
    title: 'Veteran Runner',
    description: 'Reach run level 5.',
    iconPath: '/assets/icons/xp.png',
  },
  {
    id: 'meta-run-level-10',
    category: 'meta',
    title: 'Road Legend',
    description: 'Reach run level 10.',
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
    id: 'economy-omen',
    category: 'economy',
    title: 'Omen Touched',
    description: 'Resolve an omen on a run.',
    iconPath: '/assets/icons/rare-gem.png',
  },
];

export const RUN_MILESTONE_CATALOG: RunMilestoneDefinition[] = [
  ...BOSS_MILESTONES,
  ...STATIC_MILESTONES,
];

function isMilestoneUnlocked(state: DailyRunState, milestone: RunMilestoneDefinition): boolean {
  const defeatedBosses = getDefeatedBossNames(state);
  const unlockedSpells = getUnlockedSpellNames(state);
  const clearedRuns = state.history.filter(entry => entry.wins >= entry.targetBattles);

  switch (milestone.id) {
    case 'road-first-clear':
      return state.completions > 0;
    case 'road-five-wins':
      return state.history.some(entry => entry.wins >= 5);
    case 'road-hard-route':
      return historyHasRouteKeyword(state, 'hard');
    case 'army-priest-recruit':
      return clearedRuns.some(entry => entry.unitsStanding > 0) && state.completions > 0;
    case 'army-knight-recruit':
      return state.completions > 0 && state.permanentStats.armyPower > 0;
    case 'army-wizard-recruit':
      return state.completions > 0 && state.permanentStats.spellPower > 0;
    case 'spell-arcane-bolt':
      return unlockedSpells.has('Arcane Bolt');
    case 'spell-frost-lance':
      return unlockedSpells.has('Frost Lance');
    case 'spell-sanctified-mend':
      return unlockedSpells.has('Sanctified Mend');
    case 'spell-blood-star':
      return unlockedSpells.has('Blood Star');
    case 'meta-run-level-5':
      return state.runLevel >= 5;
    case 'meta-run-level-10':
      return state.runLevel >= 10;
    case 'meta-ten-clears':
      return state.completions >= 10;
    case 'meta-streak-5':
      return state.streak >= 5 || state.history.some(entry => entry.streakAfter >= 5);
    case 'economy-shop-buy':
      return historyHasShopBuy(state);
    case 'economy-omen':
      return historyHasOmen(state);
    default:
      if (milestone.id.startsWith('boss-')) {
        const bossId = milestone.id.replace('boss-', '');
        const boss = BOSS_PROFILES.find(profile => profile.id === bossId);
        return boss ? defeatedBosses.has(boss.name) : false;
      }
      return false;
  }
}

export function getRunMilestoneViews(state: DailyRunState): RunMilestoneView[] {
  return RUN_MILESTONE_CATALOG.map(milestone => ({
    ...milestone,
    unlocked: isMilestoneUnlocked(state, milestone),
    progressLabel: milestone.id === 'meta-run-level-5' || milestone.id === 'meta-run-level-10'
      ? `Lv ${state.runLevel}/${milestone.id === 'meta-run-level-10' ? 10 : 5}`
      : milestone.id === 'meta-ten-clears'
        ? `${state.completions}/10`
        : undefined,
  }));
}

export function getMilestonesByCategory(state: DailyRunState, category: RunMilestoneCategory): RunMilestoneView[] {
  return getRunMilestoneViews(state).filter(view => view.category === category);
}

export function getRunMilestoneCategorySummaries(state: DailyRunState): RunMilestoneCategorySummary[] {
  const views = getRunMilestoneViews(state);
  const categories: RunMilestoneCategory[] = ['boss', 'road', 'army', 'spell'];

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
  const priority = ['road-first-clear', 'meta-run-level-5', 'boss-mother-cindervein', 'spell-arcane-bolt', 'economy-shop-buy', 'army-priest-recruit'];
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

export function getRunMilestoneUnlockCounts(state: DailyRunState): { unlocked: number; total: number } {
  const views = getRunMilestoneViews(state);
  return {
    unlocked: views.filter(view => view.unlocked).length,
    total: views.length,
  };
}
