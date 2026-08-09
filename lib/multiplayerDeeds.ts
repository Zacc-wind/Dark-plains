import type { MultiplayerEngagementEvent } from './multiplayerEngagement';
import type { ChronicleEntitlement } from './multiplayerChronicle';
import { BLACK_PIKE_CHRONICLE_ID } from './multiplayerChronicle';

export type MultiplayerDeedCategory = 'chapter' | 'boss' | 'contract' | 'chronicle' | 'social';

export interface MultiplayerDeedDefinition {
  id: string;
  category: MultiplayerDeedCategory;
  title: string;
  description: string;
  required: number;
  rewards: {
    gold?: number;
    rareGems?: number;
    entitlement?: ChronicleEntitlement;
  };
  progress: (events: readonly MultiplayerEngagementEvent[], context: MultiplayerDeedProgressContext) => number;
}

export interface MultiplayerDeedProgressContext {
  claimedChronicleRanks: number;
  claimedStoryQuests: number;
}

export interface MultiplayerDeedsState {
  version: number;
  claimedDeedIds: string[];
  entitlements: ChronicleEntitlement[];
  telemetry: {
    deedsClaimed: number;
  };
}

export interface MultiplayerDeedView extends Omit<MultiplayerDeedDefinition, 'progress'> {
  progress: number;
  complete: boolean;
  claimed: boolean;
}

export interface MultiplayerDeedsView {
  state: MultiplayerDeedsState;
  deeds: MultiplayerDeedView[];
  claimableCount: number;
}

export const MULTIPLAYER_DEEDS_VERSION = 1;

const entitlement = (
  id: string,
  kind: ChronicleEntitlement['kind'],
  label: string,
  description: string,
): ChronicleEntitlement => ({ id, kind, label, description });

function countKind(events: readonly MultiplayerEngagementEvent[], kind: MultiplayerEngagementEvent['kind']): number {
  return events.filter(event => event.kind === kind).length;
}

export const MULTIPLAYER_DEEDS: MultiplayerDeedDefinition[] = [
  {
    id: 'deed-first-banner',
    category: 'chapter',
    title: 'First Banner Raised',
    description: 'Claim eight story quests on the campaign road.',
    required: 8,
    rewards: {
      gold: 100,
      entitlement: entitlement('deed-title-first-banner', 'title', 'Banner Raised', 'Recorded for commanders who finished the opening campaign stretch.'),
    },
    progress: (_events, context) => context.claimedStoryQuests,
  },
  {
    id: 'deed-boss-hunter',
    category: 'boss',
    title: 'Named Threats Broken',
    description: 'Record three boss-defeated engagement receipts.',
    required: 3,
    rewards: {
      rareGems: 1,
      entitlement: entitlement('deed-lore-boss-hunter', 'lore', 'Threat Ledger', 'A short list of named threats your banner has ended.'),
    },
    progress: events => countKind(events, 'boss-defeated'),
  },
  {
    id: 'deed-contract-hand',
    category: 'contract',
    title: 'Town Board Hand',
    description: 'Complete ten city contracts.',
    required: 10,
    rewards: {
      gold: 160,
      entitlement: entitlement('deed-frame-contract-hand', 'frame', 'Board Hand Frame', 'A frame for commanders who keep town boards moving.'),
    },
    progress: events => countKind(events, 'city-contract-completed'),
  },
  {
    id: 'deed-ledger-climber',
    category: 'chronicle',
    title: 'Ledger Climber',
    description: 'Claim five Black Pike Ledger ranks.',
    required: 5,
    rewards: {
      rareGems: 2,
      entitlement: entitlement('deed-banner-ledger', 'banner', 'Ledger Climber Pattern', 'A banner stitch for climbing the featured Chronicle.'),
    },
    progress: (_events, context) => context.claimedChronicleRanks,
  },
  {
    id: 'deed-road-worker',
    category: 'contract',
    title: 'Road Worker',
    description: 'Complete twenty road jobs.',
    required: 20,
    rewards: {
      gold: 140,
      entitlement: entitlement('deed-lore-road-worker', 'lore', 'Road Worker Notes', 'Job tallies proving your banner still works ordinary roads.'),
    },
    progress: events => countKind(events, 'job-completed'),
  },
  {
    id: 'deed-social-signal',
    category: 'social',
    title: 'Company Signal',
    description: 'Complete three party, trade, or co-op social results.',
    required: 3,
    rewards: {
      gold: 120,
      entitlement: entitlement('deed-title-company', 'title', 'Company Signal', 'A social title for banners that answer company calls.'),
    },
    progress: events => (
      countKind(events, 'party-action')
      + countKind(events, 'trade-completed')
      + countKind(events, 'coop-completed')
    ),
  },
  {
    id: 'deed-dungeon-sounding',
    category: 'boss',
    title: 'Dungeon Sounding',
    description: 'Clear three dungeons.',
    required: 3,
    rewards: {
      rareGems: 1,
      entitlement: entitlement('deed-lore-dungeon', 'lore', 'Dungeon Sounding', 'Ward echoes returned from sealed chambers.'),
    },
    progress: events => countKind(events, 'dungeon-cleared'),
  },
  {
    id: 'deed-act-finisher',
    category: 'chapter',
    title: 'Act Finisher',
    description: 'Claim twenty story quests across the campaign.',
    required: 20,
    rewards: {
      gold: 240,
      rareGems: 2,
      entitlement: entitlement('deed-title-act-finisher', 'title', 'Act Finisher', 'A title for commanders who keep finishing authored chapters.'),
    },
    progress: (_events, context) => context.claimedStoryQuests,
  },
];

export function normalizeMultiplayerDeedsState(
  state: Partial<MultiplayerDeedsState> | null | undefined,
): MultiplayerDeedsState {
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
  return {
    version: MULTIPLAYER_DEEDS_VERSION,
    claimedDeedIds: Array.from(new Set((state?.claimedDeedIds || [])
      .filter(id => typeof id === 'string' && MULTIPLAYER_DEEDS.some(deed => deed.id === id)))),
    entitlements: Array.from(entitlementsById.values()),
    telemetry: {
      deedsClaimed: Math.max(0, Math.floor(state?.telemetry?.deedsClaimed || 0)),
    },
  };
}

export function getMultiplayerDeedsView(
  state: Partial<MultiplayerDeedsState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
  context: MultiplayerDeedProgressContext,
): MultiplayerDeedsView {
  const normalized = normalizeMultiplayerDeedsState(state);
  const deeds = MULTIPLAYER_DEEDS.map(deed => {
    const progress = Math.min(deed.required, Math.max(0, Math.floor(deed.progress(events, context))));
    const claimed = normalized.claimedDeedIds.includes(deed.id);
    return {
      ...deed,
      progress,
      complete: progress >= deed.required,
      claimed,
    };
  });
  return {
    state: normalized,
    deeds,
    claimableCount: deeds.filter(deed => deed.complete && !deed.claimed).length,
  };
}

export function claimMultiplayerDeed(
  state: Partial<MultiplayerDeedsState> | null | undefined,
  events: readonly MultiplayerEngagementEvent[],
  context: MultiplayerDeedProgressContext,
  deedId: string,
): {
  success: boolean;
  state: MultiplayerDeedsState;
  deed?: MultiplayerDeedView;
  error?: string;
} {
  const view = getMultiplayerDeedsView(state, events, context);
  const deed = view.deeds.find(candidate => candidate.id === deedId);
  if (!deed) return { success: false, state: view.state, error: 'Unknown deed.' };
  if (!deed.complete) return { success: false, state: view.state, deed, error: 'Deed is not complete yet.' };
  if (deed.claimed) return { success: false, state: view.state, deed, error: 'Deed already claimed.' };

  const entitlementMap = new Map(view.state.entitlements.map(item => [item.id, item]));
  if (deed.rewards.entitlement) entitlementMap.set(deed.rewards.entitlement.id, deed.rewards.entitlement);

  return {
    success: true,
    deed,
    state: normalizeMultiplayerDeedsState({
      ...view.state,
      claimedDeedIds: [...view.state.claimedDeedIds, deed.id],
      entitlements: Array.from(entitlementMap.values()),
      telemetry: {
        deedsClaimed: view.state.telemetry.deedsClaimed + 1,
      },
    }),
  };
}

export function countClaimedChronicleRanks(
  claimedRankIds: string[] | null | undefined,
  chronicleId = BLACK_PIKE_CHRONICLE_ID,
): number {
  return (claimedRankIds || []).filter(id => id.startsWith(`${chronicleId}:rank-`)).length;
}
