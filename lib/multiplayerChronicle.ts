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
  minionTemplateId?: string;
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
  /** Secondary archive tracks (e.g. Glass Road Memorial) progress at a slower baseline. */
  archiveTracks?: Record<string, {
    renown: number;
    processedEventIds: string[];
    contributionCounts: Record<string, number>;
    claimedRankIds: string[];
  }>;
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
export const GLASS_ROAD_MEMORIAL_ID = 'glass-road-memorial';
export const MULTIPLAYER_CHRONICLE_VERSION = 2;
const MAX_PROCESSED_EVENT_IDS = 1200;
const MAX_CONTRIBUTION_WINDOWS = 260;
const ARCHIVE_RENOWN_MULTIPLIER = 0.5;

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
  { rank: 5, renownRequired: 250, title: 'Mended Pike', rewards: [{ minionTemplateId: 'crossbow' }, { entitlement: entitlement('banner-mended-pike', 'banner', 'Mended Pike Pattern', 'A stitched black-and-blue banner pattern reclaimed from the toll camps.') }] },
  { rank: 6, renownRequired: 300, title: 'Road Pay', rewards: [{ gold: 160 }] },
  { rank: 7, renownRequired: 350, title: 'Compact Gem', rewards: [{ rareGems: 1 }] },
  { rank: 8, renownRequired: 400, title: 'Names Of Defectors', rewards: [{ entitlement: entitlement('ledger-lore-defectors', 'lore', 'Names Of Defectors', 'Marshal Orren\'s notes on the soldiers who abandoned the Pike.') }] },
  { rank: 9, renownRequired: 450, title: 'Recovered Cache', rewards: [{ itemId: 'decent-loot-chest', itemQuantity: 1 }] },
  { rank: 10, renownRequired: 500, title: 'Ledger Keeper', rewards: [{ minionTemplateId: 'bell' }, { entitlement: entitlement('frame-ledger-bronze', 'frame', 'Ledger Keeper Frame', 'A bronze nameplate frame stamped with the Candle Compact road seal.') }] },
  { rank: 11, renownRequired: 550, title: 'Marshal Pay', rewards: [{ gold: 200 }] },
  { rank: 12, renownRequired: 600, title: 'River Gems', rewards: [{ rareGems: 2 }] },
  { rank: 13, renownRequired: 650, title: 'The Failed Expedition', rewards: [{ entitlement: entitlement('ledger-lore-expedition', 'lore', 'The Failed Expedition', 'The missing field report from Orren\'s first western campaign.') }] },
  { rank: 14, renownRequired: 700, title: 'Quartermaster Cache', rewards: [{ itemId: 'rare-loot-chest', itemQuantity: 1 }] },
  { rank: 15, renownRequired: 750, title: 'Eclipsed Ledger', rewards: [{ minionTemplateId: 'enchanter' }, { entitlement: entitlement('banner-eclipsed-ledger', 'banner', 'Eclipsed Ledger Pattern', 'A black ledger-line pattern crossed by the repaired blue oath.') }] },
  { rank: 16, renownRequired: 800, title: 'Veteran Pay', rewards: [{ gold: 240 }] },
  { rank: 17, renownRequired: 850, title: 'Moonwell Gems', rewards: [{ rareGems: 2 }] },
  { rank: 18, renownRequired: 900, title: 'Moonwell Payments', rewards: [{ entitlement: entitlement('ledger-lore-moonwell', 'lore', 'Moonwell Payments', 'A cipher page connecting Black Pike toll money to the Drowned Moonwell.') }] },
  { rank: 19, renownRequired: 950, title: 'Relic Provision', rewards: [{ itemId: 'relic-gem-sack', itemQuantity: 1 }] },
  {
    rank: 20,
    renownRequired: 1000,
    title: 'Roadsworn',
    rewards: [
      { minionTemplateId: 'crow' },
      { entitlement: entitlement('title-roadsworn', 'title', 'Roadsworn', 'A commander title for completing the Black Pike Ledger pilot.') },
      { entitlement: entitlement('banner-repaired-eclipsed', 'banner', 'Repaired Eclipsed Banner', 'The completed Season Zero banner set.') },
    ],
  },
  { rank: 21, renownRequired: 1050, title: 'Eastern Pay', rewards: [{ gold: 260 }] },
  { rank: 22, renownRequired: 1100, title: 'Gate Gems', rewards: [{ rareGems: 2 }] },
  { rank: 23, renownRequired: 1150, title: 'Choir Notes', rewards: [{ entitlement: entitlement('ledger-lore-choir', 'lore', 'Choir Notes', 'Field notes on how the iron choir forged names into steel.') }] },
  { rank: 24, renownRequired: 1200, title: 'March Cache', rewards: [{ itemId: 'rare-loot-chest', itemQuantity: 1 }] },
  { rank: 25, renownRequired: 1250, title: 'Crownward', rewards: [{ minionTemplateId: 'mercenary' }, { entitlement: entitlement('banner-crownward', 'banner', 'Crownward Pattern', 'A black-and-iron banner stitch from the Broken Crown marches.') }] },
  { rank: 26, renownRequired: 1300, title: 'Syndicate Pay', rewards: [{ gold: 280 }] },
  { rank: 27, renownRequired: 1350, title: 'Glass Gems', rewards: [{ rareGems: 2 }] },
  { rank: 28, renownRequired: 1400, title: 'Writ Forgeries', rewards: [{ entitlement: entitlement('ledger-lore-writs', 'lore', 'Writ Forgeries', 'A packet of mirror-bought road contracts seized at Blackwater Gate.') }] },
  { rank: 29, renownRequired: 1450, title: 'Ossuary Cache', rewards: [{ itemId: 'relic-gem-sack', itemQuantity: 1 }] },
  { rank: 30, renownRequired: 1500, title: 'Glassbound', rewards: [{ minionTemplateId: 'witchdoc' }, { entitlement: entitlement('frame-glassbound', 'frame', 'Glassbound Frame', 'A mirrored nameplate frame stamped after the Glass Road seal.') }] },
  { rank: 31, renownRequired: 1550, title: 'Hold Pay', rewards: [{ gold: 300 }] },
  { rank: 32, renownRequired: 1600, title: 'Key Gems', rewards: [{ rareGems: 3 }] },
  { rank: 33, renownRequired: 1650, title: 'Candle Fragments', rewards: [{ entitlement: entitlement('ledger-lore-candle-key', 'lore', 'Candle Fragments', 'A partial diagram of the candle key race toward the Mirror Court.') }] },
  { rank: 34, renownRequired: 1700, title: 'Veteran Cache', rewards: [{ itemId: 'epic-loot-chest', itemQuantity: 1 }] },
  { rank: 35, renownRequired: 1750, title: 'Keywarden', rewards: [{ minionTemplateId: 'darkpriest' }, { entitlement: entitlement('banner-keywarden', 'banner', 'Keywarden Pattern', 'A candle-stitched banner reserved for commanders who outlasted the ledger\'s middle ranks.') }] },
  { rank: 36, renownRequired: 1800, title: 'Court Pay', rewards: [{ gold: 320 }] },
  { rank: 37, renownRequired: 1850, title: 'Reflection Gems', rewards: [{ rareGems: 3 }] },
  { rank: 38, renownRequired: 1900, title: 'Lady\'s Index', rewards: [{ entitlement: entitlement('ledger-lore-lady', 'lore', 'Lady\'s Index', 'An incomplete index of reflected victories the court intends to field.') }] },
  { rank: 39, renownRequired: 1950, title: 'Final Provision', rewards: [{ itemId: 'sealed-spell-cache', itemQuantity: 1 }] },
  {
    rank: 40,
    renownRequired: 2000,
    title: 'Ledger Complete',
    rewards: [
      { minionTemplateId: 'fallen' },
      { entitlement: entitlement('title-ledger-complete', 'title', 'Ledger Complete', 'A commander title for finishing the expanded Black Pike Ledger.') },
      { entitlement: entitlement('banner-ledger-complete', 'banner', 'Complete Ledger Banner', 'The finished Black Pike Ledger honor set.') },
    ],
  },
];

export const GLASS_ROAD_MEMORIAL_RANKS: ChronicleRankDefinition[] = [
  { rank: 1, renownRequired: 40, title: 'Mirrored Toll', rewards: [{ gold: 100 }] },
  { rank: 2, renownRequired: 80, title: 'Writ Ash', rewards: [{ rareGems: 1 }] },
  { rank: 3, renownRequired: 120, title: 'Broken Glass Notes', rewards: [{ entitlement: entitlement('memorial-lore-glass', 'lore', 'Broken Glass Notes', 'Archived field notes from the sealed Glass Road.') }] },
  { rank: 4, renownRequired: 160, title: 'Quarry Memory', rewards: [{ itemId: 'black-amber', itemQuantity: 1 }] },
  { rank: 5, renownRequired: 200, title: 'Gate Memorial', rewards: [{ entitlement: entitlement('memorial-banner-gate', 'banner', 'Gate Memorial Pattern', 'An archived banner stitch for commanders who sealed the Glass Road.') }] },
  { rank: 6, renownRequired: 240, title: 'Ossuary Pay', rewards: [{ gold: 140 }] },
  { rank: 7, renownRequired: 280, title: 'Prior Echo', rewards: [{ rareGems: 1 }] },
  { rank: 8, renownRequired: 320, title: 'Moon Glass Shard', rewards: [{ entitlement: entitlement('memorial-lore-voss', 'lore', 'Moon Glass Shard', 'A quieter memorial page for Prior Moon Voss\'s fall.') }] },
  { rank: 9, renownRequired: 360, title: 'Hold Cache', rewards: [{ itemId: 'decent-loot-chest', itemQuantity: 1 }] },
  {
    rank: 10,
    renownRequired: 400,
    title: 'Road Memorial',
    rewards: [
      { entitlement: entitlement('memorial-title-road', 'title', 'Road Memorial', 'An archived title for finishing the Glass Road memorial track.') },
      { entitlement: entitlement('memorial-frame-road', 'frame', 'Memorial Frame', 'A quieter frame kept in the Chronicle archive.') },
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
  const archiveTracks = Object.fromEntries(
    Object.entries(state?.archiveTracks || {}).map(([trackId, track]) => {
      const trackCounts = Object.entries(track?.contributionCounts || {})
        .filter(([key, value]) => key && Number.isFinite(value) && value > 0)
        .slice(-MAX_CONTRIBUTION_WINDOWS);
      return [trackId, {
        renown: Math.max(0, Math.floor(track?.renown || 0)),
        processedEventIds: Array.from(new Set((track?.processedEventIds || [])
          .filter(id => typeof id === 'string' && id.trim())
          .map(id => id.trim().slice(0, 180))))
          .slice(-MAX_PROCESSED_EVENT_IDS),
        contributionCounts: Object.fromEntries(trackCounts.map(([key, value]) => [key, Math.max(1, Math.floor(value))])),
        claimedRankIds: Array.from(new Set((track?.claimedRankIds || [])
          .filter(id => typeof id === 'string' && id.startsWith(`${trackId}:rank-`)))),
      }];
    }),
  );
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
    archiveTracks,
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

  const archive = normalized.archiveTracks?.[GLASS_ROAD_MEMORIAL_ID] || {
    renown: 0,
    processedEventIds: [],
    contributionCounts: {},
    claimedRankIds: [],
  };
  const archiveProcessed = new Set(archive.processedEventIds);
  const archiveCounts = { ...archive.contributionCounts };
  let archiveRenownAwarded = 0;

  [...events].sort((left, right) => left.occurredAt - right.occurredAt).forEach(event => {
    if (!event.id) return;
    const rule = CONTRIBUTION_RULES[event.kind];

    if (!processed.has(event.id)) {
      processed.add(event.id);
      if (rule) {
        const key = contributionKey(rule, event);
        const count = counts[key] || 0;
        if (count < rule.cap) {
          counts[key] = count + 1;
          renownAwarded += rule.renown;
          eventsAwarded += 1;
        }
      }
    }

    if (!archiveProcessed.has(event.id)) {
      archiveProcessed.add(event.id);
      if (rule) {
        const key = contributionKey(rule, event);
        const count = archiveCounts[key] || 0;
        if (count < rule.cap) {
          archiveCounts[key] = count + 1;
          archiveRenownAwarded += Math.max(1, Math.floor(rule.renown * ARCHIVE_RENOWN_MULTIPLIER));
        }
      }
    }
  });

  return normalizeMultiplayerChronicleState({
    ...normalized,
    renown: normalized.renown + renownAwarded,
    processedEventIds: Array.from(processed).slice(-MAX_PROCESSED_EVENT_IDS),
    contributionCounts: counts,
    archiveTracks: {
      ...normalized.archiveTracks,
      [GLASS_ROAD_MEMORIAL_ID]: {
        renown: archive.renown + archiveRenownAwarded,
        processedEventIds: Array.from(archiveProcessed).slice(-MAX_PROCESSED_EVENT_IDS),
        contributionCounts: archiveCounts,
        claimedRankIds: archive.claimedRankIds,
      },
    },
    telemetry: {
      ...normalized.telemetry,
      eventsAwarded: normalized.telemetry.eventsAwarded + eventsAwarded,
      renownAwarded: normalized.telemetry.renownAwarded + renownAwarded,
    },
  });
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
    subtitle: 'Featured free track - no expiry',
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

export interface MultiplayerChronicleArchiveView {
  id: string;
  title: string;
  subtitle: string;
  unlocked: boolean;
  unlockHint: string;
  renown: number;
  currentRank: number;
  ranks: MultiplayerChronicleRankView[];
  claimableCount: number;
  state: MultiplayerChronicleState;
}

export function getMultiplayerChronicleArchiveView(
  state: Partial<MultiplayerChronicleState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
  unlocked = false,
): MultiplayerChronicleArchiveView {
  const synced = syncMultiplayerChronicleEvents(state, events);
  const track = synced.archiveTracks?.[GLASS_ROAD_MEMORIAL_ID] || {
    renown: 0,
    processedEventIds: [],
    contributionCounts: {},
    claimedRankIds: [],
  };
  const currentRank = GLASS_ROAD_MEMORIAL_RANKS.filter(rank => track.renown >= rank.renownRequired).length;
  const ranks = GLASS_ROAD_MEMORIAL_RANKS.map(rank => {
    const id = `${GLASS_ROAD_MEMORIAL_ID}:rank-${rank.rank}`;
    return {
      ...rank,
      id,
      unlocked: unlocked && track.renown >= rank.renownRequired,
      claimed: track.claimedRankIds.includes(id),
    };
  });
  return {
    id: GLASS_ROAD_MEMORIAL_ID,
    title: 'Glass Road Memorial',
    subtitle: 'Archive track - half Renown rate after the Glass Road is sealed',
    unlocked,
    unlockHint: 'Seal the Glass Road chapter to claim memorial ranks.',
    renown: track.renown,
    currentRank,
    ranks,
    claimableCount: unlocked ? ranks.filter(rank => rank.unlocked && !rank.claimed).length : 0,
    state: synced,
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

export function claimMultiplayerChronicleArchiveRank(
  state: Partial<MultiplayerChronicleState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
  rankNumber: number,
  unlocked: boolean,
): { success: boolean; state: MultiplayerChronicleState; rank?: MultiplayerChronicleRankView; error?: string } {
  const view = getMultiplayerChronicleArchiveView(state, events, unlocked);
  if (!view.unlocked) return { success: false, state: view.state, error: view.unlockHint };
  const rank = view.ranks.find(candidate => candidate.rank === Math.floor(rankNumber));
  if (!rank) return { success: false, state: view.state, error: 'Unknown memorial rank.' };
  if (!rank.unlocked) return { success: false, state: view.state, rank, error: `Memorial rank ${rank.rank} requires ${rank.renownRequired} Renown.` };
  if (rank.claimed) return { success: false, state: view.state, rank, error: `Memorial rank ${rank.rank} already claimed.` };

  const track = view.state.archiveTracks?.[GLASS_ROAD_MEMORIAL_ID] || {
    renown: 0,
    processedEventIds: [],
    contributionCounts: {},
    claimedRankIds: [],
  };
  const entitlementMap = new Map(view.state.entitlements.map(item => [item.id, item]));
  rank.rewards.forEach(reward => {
    if (reward.entitlement) entitlementMap.set(reward.entitlement.id, reward.entitlement);
  });

  return {
    success: true,
    rank,
    state: normalizeMultiplayerChronicleState({
      ...view.state,
      entitlements: Array.from(entitlementMap.values()),
      archiveTracks: {
        ...view.state.archiveTracks,
        [GLASS_ROAD_MEMORIAL_ID]: {
          ...track,
          claimedRankIds: [...track.claimedRankIds, rank.id],
        },
      },
      telemetry: {
        ...view.state.telemetry,
        ranksClaimed: view.state.telemetry.ranksClaimed + 1,
      },
    }),
  };
}
