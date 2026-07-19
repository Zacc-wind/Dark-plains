import type { MultiplayerEngagementEvent } from './multiplayerEngagement';

export type ChronicleEntitlementKind = 'banner' | 'frame' | 'title' | 'lore';

export interface ChronicleEntitlement {
  id: string;
  kind: ChronicleEntitlementKind;
  label: string;
  description: string;
}

export interface ChronicleRankReward {
  gold?: number;
  rareGems?: number;
  itemId?: string;
  itemQuantity?: number;
  entitlement?: ChronicleEntitlement;
}

export interface ChronicleRankDefinition {
  rank: number;
  renownRequired: number;
  title: string;
  rewards: ChronicleRankReward[];
}

export interface MultiplayerChronicleState {
  version: number;
  chronicleId: string;
  renown: number;
  processedEventIds: string[];
  contributionCounts: Record<string, number>;
  claimedRankIds: string[];
  entitlements: ChronicleEntitlement[];
  telemetry: {
    eventsAwarded: number;
    renownAwarded: number;
    ranksClaimed: number;
  };
}

export interface MultiplayerChronicleRankView extends ChronicleRankDefinition {
  id: string;
  unlocked: boolean;
  claimed: boolean;
}

export interface MultiplayerChronicleView {
  id: string;
  title: string;
  subtitle: string;
  guideName: string;
  state: MultiplayerChronicleState;
  currentRank: number;
  nextRankRenown: number;
  progressIntoRank: number;
  progressTarget: number;
  ranks: MultiplayerChronicleRankView[];
  claimableCount: number;
}

export const BLACK_PIKE_CHRONICLE_ID = 'black-pike-ledger-pilot';
export const MULTIPLAYER_CHRONICLE_VERSION = 1;
const MAX_PROCESSED_EVENT_IDS = 1200;
const MAX_CONTRIBUTION_WINDOWS = 260;

const entitlement = (
  id: string,
  kind: ChronicleEntitlementKind,
  label: string,
  description: string,
): ChronicleEntitlement => ({ id, kind, label, description });

export const BLACK_PIKE_CHRONICLE_RANKS: ChronicleRankDefinition[] = [
  { rank: 1, renownRequired: 50, title: 'First Entry', rewards: [{ gold: 120 }] },
  { rank: 2, renownRequired: 100, title: 'Road Provision', rewards: [{ rareGems: 1 }] },
  { rank: 3, renownRequired: 150, title: 'The Toll Records', rewards: [{ entitlement: entitlement('ledger-lore-tolls', 'lore', 'The Toll Records', 'A copied leaf listing every illegal Black Pike toll on the western road.') }] },
  { rank: 4, renownRequired: 200, title: 'Amber Requisition', rewards: [{ itemId: 'black-amber', itemQuantity: 2 }] },
  { rank: 5, renownRequired: 250, title: 'Mended Pike', rewards: [{ entitlement: entitlement('banner-mended-pike', 'banner', 'Mended Pike Pattern', 'A stitched black-and-blue banner pattern reclaimed from the toll camps.') }] },
  { rank: 6, renownRequired: 300, title: 'Road Pay', rewards: [{ gold: 160 }] },
  { rank: 7, renownRequired: 350, title: 'Compact Gem', rewards: [{ rareGems: 1 }] },
  { rank: 8, renownRequired: 400, title: 'Names Of Defectors', rewards: [{ entitlement: entitlement('ledger-lore-defectors', 'lore', 'Names Of Defectors', 'Marshal Orren\'s notes on the soldiers who abandoned the Pike.') }] },
  { rank: 9, renownRequired: 450, title: 'Recovered Cache', rewards: [{ itemId: 'decent-loot-chest', itemQuantity: 1 }] },
  { rank: 10, renownRequired: 500, title: 'Ledger Keeper', rewards: [{ entitlement: entitlement('frame-ledger-bronze', 'frame', 'Ledger Keeper Frame', 'A bronze nameplate frame stamped with the Candle Compact road seal.') }] },
  { rank: 11, renownRequired: 550, title: 'Marshal Pay', rewards: [{ gold: 200 }] },
  { rank: 12, renownRequired: 600, title: 'River Gems', rewards: [{ rareGems: 2 }] },
  { rank: 13, renownRequired: 650, title: 'The Failed Expedition', rewards: [{ entitlement: entitlement('ledger-lore-expedition', 'lore', 'The Failed Expedition', 'The missing field report from Orren\'s first western campaign.') }] },
  { rank: 14, renownRequired: 700, title: 'Quartermaster Cache', rewards: [{ itemId: 'rare-loot-chest', itemQuantity: 1 }] },
  { rank: 15, renownRequired: 750, title: 'Eclipsed Ledger', rewards: [{ entitlement: entitlement('banner-eclipsed-ledger', 'banner', 'Eclipsed Ledger Pattern', 'A black ledger-line pattern crossed by the repaired blue oath.') }] },
  { rank: 16, renownRequired: 800, title: 'Veteran Pay', rewards: [{ gold: 240 }] },
  { rank: 17, renownRequired: 850, title: 'Moonwell Gems', rewards: [{ rareGems: 2 }] },
  { rank: 18, renownRequired: 900, title: 'Moonwell Payments', rewards: [{ entitlement: entitlement('ledger-lore-moonwell', 'lore', 'Moonwell Payments', 'A cipher page connecting Black Pike toll money to the Drowned Moonwell.') }] },
  { rank: 19, renownRequired: 950, title: 'Relic Provision', rewards: [{ itemId: 'relic-gem-sack', itemQuantity: 1 }] },
  {
    rank: 20,
    renownRequired: 1000,
    title: 'Roadsworn',
    rewards: [
      { entitlement: entitlement('title-roadsworn', 'title', 'Roadsworn', 'A commander title for completing the Black Pike Ledger pilot.') },
      { entitlement: entitlement('banner-repaired-eclipsed', 'banner', 'Repaired Eclipsed Banner', 'The completed Season Zero banner set.') },
    ],
  },
];

interface ChronicleContributionRule {
  id: string;
  renown: number;
  window: 'event' | 'day' | 'week';
  cap: number;
}

const CONTRIBUTION_RULES: Partial<Record<MultiplayerEngagementEvent['kind'], ChronicleContributionRule>> = {
  'daily-contract-claimed': { id: 'daily-contract', renown: 18, window: 'event', cap: 1 },
  'weekly-oath-claimed': { id: 'weekly-oath', renown: 60, window: 'event', cap: 1 },
  'story-quest-completed': { id: 'story-quest', renown: 28, window: 'event', cap: 1 },
  'city-contract-completed': { id: 'city-contract', renown: 12, window: 'day', cap: 3 },
  'job-completed': { id: 'road-job', renown: 4, window: 'day', cap: 3 },
  'battle-result-claimed': { id: 'first-weekly-win', renown: 20, window: 'week', cap: 1 },
  'dungeon-cleared': { id: 'first-weekly-dungeon', renown: 35, window: 'week', cap: 1 },
  'boss-defeated': { id: 'boss-resolution', renown: 20, window: 'week', cap: 2 },
  'regional-threat-claimed': { id: 'regional-threat', renown: 55, window: 'event', cap: 1 },
  'friend-action': { id: 'friend-signal', renown: 4, window: 'day', cap: 1 },
  'party-action': { id: 'party-signal', renown: 6, window: 'day', cap: 1 },
  'trade-completed': { id: 'player-trade', renown: 15, window: 'day', cap: 1 },
  'pvp-completed': { id: 'pvp-result', renown: 12, window: 'day', cap: 2 },
  'coop-completed': { id: 'coop-result', renown: 22, window: 'week', cap: 2 },
};

function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekKey(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - offset);
  return dateKey(date.getTime());
}

function contributionKey(rule: ChronicleContributionRule, event: MultiplayerEngagementEvent): string {
  if (rule.window === 'event') return `event:${rule.id}:${event.id}`;
  return `${rule.window}:${rule.id}:${rule.window === 'day' ? dateKey(event.occurredAt) : weekKey(event.occurredAt)}`;
}

export function normalizeMultiplayerChronicleState(
  state: Partial<MultiplayerChronicleState> | null | undefined,
): MultiplayerChronicleState {
  const entitlementsById = new Map<string, ChronicleEntitlement>();
  (state?.entitlements || []).forEach(item => {
    if (!item?.id || !['banner', 'frame', 'title', 'lore'].includes(item.kind)) return;
    entitlementsById.set(item.id, {
      id: item.id.trim().slice(0, 160),
      kind: item.kind,
      label: (item.label || item.id).trim().slice(0, 100),
      description: (item.description || '').trim().slice(0, 300),
    });
  });
  const contributionEntries = Object.entries(state?.contributionCounts || {})
    .filter(([key, value]) => key && Number.isFinite(value) && value > 0)
    .slice(-MAX_CONTRIBUTION_WINDOWS);
  return {
    version: MULTIPLAYER_CHRONICLE_VERSION,
    chronicleId: BLACK_PIKE_CHRONICLE_ID,
    renown: Math.max(0, Math.floor(state?.renown || 0)),
    processedEventIds: Array.from(new Set((state?.processedEventIds || [])
      .filter(id => typeof id === 'string' && id.trim())
      .map(id => id.trim().slice(0, 180))))
      .slice(-MAX_PROCESSED_EVENT_IDS),
    contributionCounts: Object.fromEntries(contributionEntries.map(([key, value]) => [key, Math.max(1, Math.floor(value))])),
    claimedRankIds: Array.from(new Set((state?.claimedRankIds || [])
      .filter(id => typeof id === 'string' && id.startsWith(`${BLACK_PIKE_CHRONICLE_ID}:rank-`)))),
    entitlements: Array.from(entitlementsById.values()),
    telemetry: {
      eventsAwarded: Math.max(0, Math.floor(state?.telemetry?.eventsAwarded || 0)),
      renownAwarded: Math.max(0, Math.floor(state?.telemetry?.renownAwarded || 0)),
      ranksClaimed: Math.max(0, Math.floor(state?.telemetry?.ranksClaimed || 0)),
    },
  };
}

export function syncMultiplayerChronicleEvents(
  state: Partial<MultiplayerChronicleState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
): MultiplayerChronicleState {
  let normalized = normalizeMultiplayerChronicleState(state);
  const processed = new Set(normalized.processedEventIds);
  const counts = { ...normalized.contributionCounts };
  let renownAwarded = 0;
  let eventsAwarded = 0;

  [...events].sort((left, right) => left.occurredAt - right.occurredAt).forEach(event => {
    if (!event.id || processed.has(event.id)) return;
    processed.add(event.id);
    const rule = CONTRIBUTION_RULES[event.kind];
    if (!rule) return;
    const key = contributionKey(rule, event);
    const count = counts[key] || 0;
    if (count >= rule.cap) return;
    counts[key] = count + 1;
    renownAwarded += rule.renown;
    eventsAwarded += 1;
  });

  normalized = normalizeMultiplayerChronicleState({
    ...normalized,
    renown: normalized.renown + renownAwarded,
    processedEventIds: Array.from(processed).slice(-MAX_PROCESSED_EVENT_IDS),
    contributionCounts: counts,
    telemetry: {
      ...normalized.telemetry,
      eventsAwarded: normalized.telemetry.eventsAwarded + eventsAwarded,
      renownAwarded: normalized.telemetry.renownAwarded + renownAwarded,
    },
  });
  return normalized;
}

export function getMultiplayerChronicleView(
  state: Partial<MultiplayerChronicleState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
): MultiplayerChronicleView {
  const synced = syncMultiplayerChronicleEvents(state, events);
  const currentRank = BLACK_PIKE_CHRONICLE_RANKS.filter(rank => synced.renown >= rank.renownRequired).length;
  const previousThreshold = currentRank > 0 ? BLACK_PIKE_CHRONICLE_RANKS[currentRank - 1].renownRequired : 0;
  const nextDefinition = BLACK_PIKE_CHRONICLE_RANKS[currentRank];
  const nextRankRenown = nextDefinition?.renownRequired || BLACK_PIKE_CHRONICLE_RANKS.at(-1)?.renownRequired || 1000;
  const ranks = BLACK_PIKE_CHRONICLE_RANKS.map(rank => {
    const id = `${BLACK_PIKE_CHRONICLE_ID}:rank-${rank.rank}`;
    return {
      ...rank,
      id,
      unlocked: synced.renown >= rank.renownRequired,
      claimed: synced.claimedRankIds.includes(id),
    };
  });
  return {
    id: BLACK_PIKE_CHRONICLE_ID,
    title: 'The Black Pike Ledger',
    subtitle: 'Season Zero balance pilot - free track, no expiry',
    guideName: 'Marshal Orren',
    state: synced,
    currentRank,
    nextRankRenown,
    progressIntoRank: Math.max(0, synced.renown - previousThreshold),
    progressTarget: Math.max(1, nextRankRenown - previousThreshold),
    ranks,
    claimableCount: ranks.filter(rank => rank.unlocked && !rank.claimed).length,
  };
}

export function claimMultiplayerChronicleRank(
  state: Partial<MultiplayerChronicleState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
  rankNumber: number,
): { success: boolean; state: MultiplayerChronicleState; rank: MultiplayerChronicleRankView; error?: string } {
  const view = getMultiplayerChronicleView(state, events);
  const rank = view.ranks.find(candidate => candidate.rank === Math.floor(rankNumber));
  if (!rank) throw new Error(`Unknown Chronicle rank: ${rankNumber}`);
  if (!rank.unlocked) return { success: false, state: view.state, rank, error: `Rank ${rank.rank} requires ${rank.renownRequired} Renown.` };
  if (rank.claimed) return { success: false, state: view.state, rank, error: `Rank ${rank.rank} already claimed.` };

  const entitlementRewards = rank.rewards.flatMap(reward => reward.entitlement ? [reward.entitlement] : []);
  const entitlementMap = new Map(view.state.entitlements.map(item => [item.id, item]));
  entitlementRewards.forEach(item => entitlementMap.set(item.id, item));
  return {
    success: true,
    rank,
    state: normalizeMultiplayerChronicleState({
      ...view.state,
      claimedRankIds: [...view.state.claimedRankIds, rank.id],
      entitlements: Array.from(entitlementMap.values()),
      telemetry: {
        ...view.state.telemetry,
        ranksClaimed: view.state.telemetry.ranksClaimed + 1,
      },
    }),
  };
}
