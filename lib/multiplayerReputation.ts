import type { MultiplayerEngagementEvent } from './multiplayerEngagement';
import { getCityQuestTemplate } from './questData';
import type { ChronicleEntitlement } from './multiplayerChronicle';

export type ReputationFactionId = 'candle-compact' | 'blackwater-league';

export interface ReputationTierReward {
  gold?: number;
  rareGems?: number;
  itemId?: string;
  itemQuantity?: number;
  spellIds?: string[];
  entitlement?: ChronicleEntitlement;
}

export interface ReputationTierDefinition {
  tier: number;
  standingRequired: number;
  title: string;
  rewards: ReputationTierReward[];
}

export interface ReputationFactionDefinition {
  id: ReputationFactionId;
  name: string;
  subtitle: string;
  unlockLevel: number;
  localFactions: string[];
  tiers: ReputationTierDefinition[];
}

export interface MultiplayerReputationFactionState {
  standing: number;
  claimedTiers: number[];
}

export interface MultiplayerReputationState {
  version: number;
  processedEventIds: string[];
  factions: Record<ReputationFactionId, MultiplayerReputationFactionState>;
  entitlements: ChronicleEntitlement[];
  telemetry: {
    eventsAwarded: number;
    standingAwarded: number;
    tiersClaimed: number;
  };
}

export interface ReputationFactionView extends ReputationFactionDefinition {
  unlocked: boolean;
  standing: number;
  claimedTiers: number[];
  nextTier: ReputationTierDefinition | null;
  claimableTiers: ReputationTierDefinition[];
}

export interface MultiplayerReputationView {
  state: MultiplayerReputationState;
  factions: ReputationFactionView[];
  claimableCount: number;
}

export const MULTIPLAYER_REPUTATION_VERSION = 1;
const MAX_PROCESSED_EVENT_IDS = 800;
const STANDING_PER_CITY_CONTRACT = 12;
const DAILY_CONTRACT_CAP = 4;

const entitlement = (
  id: string,
  kind: ChronicleEntitlement['kind'],
  label: string,
  description: string,
): ChronicleEntitlement => ({ id, kind, label, description });

export const REPUTATION_FACTIONS: ReputationFactionDefinition[] = [
  {
    id: 'candle-compact',
    name: 'Candle Compact',
    subtitle: 'Western road wards, hospices, and harbor law.',
    unlockLevel: 8,
    localFactions: [
      'Candlewardens',
      'Hospitaller Lanterns',
      'Salt Chapel',
      'Candle Synod',
      'Candle Compact',
    ],
    tiers: [
      {
        tier: 1,
        standingRequired: 40,
        title: 'Lantern Ally',
        rewards: [
          { gold: 120 },
          { entitlement: entitlement('rep-candle-lore-1', 'lore', 'Lantern Compact Note', 'Harbor law recognizes your banner as a road ally.') },
        ],
      },
      {
        tier: 2,
        standingRequired: 100,
        title: 'Salt Oath',
        rewards: [
          { rareGems: 1 },
          { spellIds: ['judgement'] },
          { entitlement: entitlement('rep-candle-title-1', 'title', 'Salt Oath', 'A Compact title for commanders who keep the western wards lit.') },
        ],
      },
      {
        tier: 3,
        standingRequired: 180,
        title: 'Candleward Banner',
        rewards: [
          { gold: 220, rareGems: 2 },
          { entitlement: entitlement('rep-candle-banner-1', 'banner', 'Candleward Pattern', 'A Compact banner stitch earned through repeated western contracts.') },
        ],
      },
    ],
  },
  {
    id: 'blackwater-league',
    name: 'Blackwater League',
    subtitle: 'Gate writs, relic weighs, and eastern syndicate work.',
    unlockLevel: 16,
    localFactions: [
      'Blackwater Syndicate',
      'Relic Weighers',
      'Gate Watch',
      'Ossuary Order',
    ],
    tiers: [
      {
        tier: 1,
        standingRequired: 40,
        title: 'Gate Contact',
        rewards: [
          { gold: 160 },
          { entitlement: entitlement('rep-blackwater-lore-1', 'lore', 'Gate Contact Writ', 'Blackwater records your banner as a trusted eastern contact.') },
        ],
      },
      {
        tier: 2,
        standingRequired: 100,
        title: 'Syndicate Seal',
        rewards: [
          { rareGems: 2 },
          { spellIds: ['moonlit-veil'] },
          { entitlement: entitlement('rep-blackwater-title-1', 'title', 'Syndicate Seal', 'A League title for commanders who keep eastern writs honest.') },
        ],
      },
      {
        tier: 3,
        standingRequired: 180,
        title: 'Ossuary Patron',
        rewards: [
          { gold: 280, itemId: 'rare-loot-chest', itemQuantity: 1 },
          { entitlement: entitlement('rep-blackwater-frame-1', 'frame', 'Ossuary Patron Frame', 'A League frame stamped for repeated Blackwater board work.') },
        ],
      },
    ],
  },
];

function emptyFactionState(): MultiplayerReputationFactionState {
  return { standing: 0, claimedTiers: [] };
}

function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getReputationFactionForLocalFaction(localFaction: string | undefined): ReputationFactionId | null {
  if (!localFaction) return null;
  const match = REPUTATION_FACTIONS.find(faction => faction.localFactions.includes(localFaction));
  return match?.id || null;
}

export function getReputationFactionForCityQuest(questId: string | undefined): ReputationFactionId | null {
  if (!questId) return null;
  return getReputationFactionForLocalFaction(getCityQuestTemplate(questId)?.faction);
}

export function normalizeMultiplayerReputationState(
  state: Partial<MultiplayerReputationState> | null | undefined,
): MultiplayerReputationState {
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

  const factions = Object.fromEntries(
    REPUTATION_FACTIONS.map(definition => {
      const existing = state?.factions?.[definition.id];
      return [definition.id, {
        standing: Math.max(0, Math.floor(existing?.standing || 0)),
        claimedTiers: Array.from(new Set((existing?.claimedTiers || [])
          .map(tier => Math.floor(tier))
          .filter(tier => tier >= 1 && tier <= definition.tiers.length))),
      }];
    }),
  ) as Record<ReputationFactionId, MultiplayerReputationFactionState>;

  return {
    version: MULTIPLAYER_REPUTATION_VERSION,
    processedEventIds: Array.from(new Set((state?.processedEventIds || [])
      .filter(id => typeof id === 'string' && id.trim())
      .map(id => id.trim().slice(0, 180))))
      .slice(-MAX_PROCESSED_EVENT_IDS),
    factions,
    entitlements: Array.from(entitlementsById.values()),
    telemetry: {
      eventsAwarded: Math.max(0, Math.floor(state?.telemetry?.eventsAwarded || 0)),
      standingAwarded: Math.max(0, Math.floor(state?.telemetry?.standingAwarded || 0)),
      tiersClaimed: Math.max(0, Math.floor(state?.telemetry?.tiersClaimed || 0)),
    },
  };
}

export function syncMultiplayerReputationEvents(
  state: Partial<MultiplayerReputationState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
): MultiplayerReputationState {
  let normalized = normalizeMultiplayerReputationState(state);
  const processed = new Set(normalized.processedEventIds);
  const dailyCounts = new Map<string, number>();
  let standingAwarded = 0;
  let eventsAwarded = 0;

  [...events].sort((left, right) => left.occurredAt - right.occurredAt).forEach(event => {
    if (processed.has(event.id) || event.kind !== 'city-contract-completed') return;
    const factionId = getReputationFactionForCityQuest(event.targetId);
    if (!factionId) {
      processed.add(event.id);
      return;
    }
    const day = dateKey(event.occurredAt);
    const dayKey = `${factionId}:${day}`;
    const used = dailyCounts.get(dayKey) || 0;
    if (used >= DAILY_CONTRACT_CAP) {
      processed.add(event.id);
      return;
    }
    dailyCounts.set(dayKey, used + 1);
    processed.add(event.id);
    const faction = normalized.factions[factionId] || emptyFactionState();
    normalized = {
      ...normalized,
      factions: {
        ...normalized.factions,
        [factionId]: {
          ...faction,
          standing: faction.standing + STANDING_PER_CITY_CONTRACT,
        },
      },
    };
    standingAwarded += STANDING_PER_CITY_CONTRACT;
    eventsAwarded += 1;
  });

  return normalizeMultiplayerReputationState({
    ...normalized,
    processedEventIds: Array.from(processed).slice(-MAX_PROCESSED_EVENT_IDS),
    telemetry: {
      eventsAwarded: normalized.telemetry.eventsAwarded + eventsAwarded,
      standingAwarded: normalized.telemetry.standingAwarded + standingAwarded,
      tiersClaimed: normalized.telemetry.tiersClaimed,
    },
  });
}

export function getMultiplayerReputationView(
  state: Partial<MultiplayerReputationState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
  playerLevel = 1,
): MultiplayerReputationView {
  const synced = syncMultiplayerReputationEvents(state, events);
  const factions = REPUTATION_FACTIONS.map(definition => {
    const factionState = synced.factions[definition.id];
    const claimableTiers = definition.tiers.filter(tier => (
      factionState.standing >= tier.standingRequired
      && !factionState.claimedTiers.includes(tier.tier)
    ));
    const nextTier = definition.tiers.find(tier => !factionState.claimedTiers.includes(tier.tier)) || null;
    return {
      ...definition,
      unlocked: playerLevel >= definition.unlockLevel,
      standing: factionState.standing,
      claimedTiers: factionState.claimedTiers,
      nextTier,
      claimableTiers,
    };
  });
  return {
    state: synced,
    factions,
    claimableCount: factions.reduce((sum, faction) => (
      sum + (faction.unlocked ? faction.claimableTiers.length : 0)
    ), 0),
  };
}

export function claimMultiplayerReputationTier(
  state: Partial<MultiplayerReputationState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
  factionId: ReputationFactionId,
  tierNumber: number,
  playerLevel = 1,
): {
  success: boolean;
  state: MultiplayerReputationState;
  tier?: ReputationTierDefinition;
  error?: string;
} {
  const view = getMultiplayerReputationView(state, events, playerLevel);
  const faction = view.factions.find(candidate => candidate.id === factionId);
  if (!faction) return { success: false, state: view.state, error: 'Unknown faction.' };
  if (!faction.unlocked) {
    return { success: false, state: view.state, error: `${faction.name} reputation unlocks at level ${faction.unlockLevel}.` };
  }
  const tier = faction.tiers.find(candidate => candidate.tier === Math.floor(tierNumber));
  if (!tier) return { success: false, state: view.state, error: 'Unknown reputation tier.' };
  if (faction.standing < tier.standingRequired) {
    return { success: false, state: view.state, tier, error: `Need ${tier.standingRequired} standing.` };
  }
  if (faction.claimedTiers.includes(tier.tier)) {
    return { success: false, state: view.state, tier, error: 'Tier already claimed.' };
  }

  const entitlementMap = new Map(view.state.entitlements.map(item => [item.id, item]));
  tier.rewards.forEach(reward => {
    if (reward.entitlement) entitlementMap.set(reward.entitlement.id, reward.entitlement);
  });

  return {
    success: true,
    tier,
    state: normalizeMultiplayerReputationState({
      ...view.state,
      factions: {
        ...view.state.factions,
        [factionId]: {
          ...view.state.factions[factionId],
          claimedTiers: [...view.state.factions[factionId].claimedTiers, tier.tier],
        },
      },
      entitlements: Array.from(entitlementMap.values()),
      telemetry: {
        ...view.state.telemetry,
        tiersClaimed: view.state.telemetry.tiersClaimed + 1,
      },
    }),
  };
}
