export type MultiplayerContractCategory = 'combat' | 'world' | 'social';
export type MultiplayerEngagementEventKind =
  | 'job-started'
  | 'job-completed'
  | 'travel-completed'
  | 'enemy-inspected'
  | 'battle-won'
  | 'battle-result-claimed'
  | 'story-quest-completed'
  | 'city-contract-completed'
  | 'boss-defeated'
  | 'dungeon-cleared'
  | 'chat-sent'
  | 'friend-action'
  | 'party-action'
  | 'trade-completed'
  | 'pvp-completed'
  | 'coop-completed'
  | 'social-action';
export type LegacyMultiplayerEngagementEventKind = 'battle-win' | 'job-start' | 'dungeon-clear';
export type MultiplayerEngagementEventInputKind = MultiplayerEngagementEventKind | LegacyMultiplayerEngagementEventKind;

export interface MultiplayerEngagementEventInput {
  id?: string;
  kind: MultiplayerEngagementEventInputKind;
  occurredAt?: number;
  contextId?: string;
  targetId?: string;
}

export interface MultiplayerEngagementEvent {
  id: string;
  kind: MultiplayerEngagementEventKind;
  occurredAt: number;
  recordedAt: number;
  actorUsername: string;
  contextId?: string;
  targetId?: string;
}

export interface MultiplayerEngagementTelemetry {
  eventsRecorded: number;
  dailyClaims: number;
  dailyRerolls: number;
  weeklyClaims: number;
  briefingsShown: number;
}

export interface ReturningPlayerBriefingState {
  daysAway: number;
  createdAt: number;
}

export interface MultiplayerEngagementState {
  version: number;
  dateKey: string;
  weekKey: string;
  contractVariants: Record<MultiplayerContractCategory, number>;
  claimedContractIds: string[];
  rerollUsed: boolean;
  weeklyClaimed: boolean;
  events: MultiplayerEngagementEvent[];
  telemetry: MultiplayerEngagementTelemetry;
  returnDays: string[];
  lastSeenAt?: number;
  pendingBriefing?: ReturningPlayerBriefingState;
}

export interface MultiplayerContractView {
  id: string;
  category: MultiplayerContractCategory;
  title: string;
  description: string;
  eventKinds: MultiplayerEngagementEventKind[];
  target: number;
  progress: number;
  complete: boolean;
  claimed: boolean;
  rewardGold: number;
  rewardExp: number;
  iconPath: string;
}

export interface MultiplayerWeeklyOathView {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  complete: boolean;
  claimed: boolean;
  rewardGold: number;
  rewardExp: number;
  contributions: Record<MultiplayerContractCategory, number>;
}

export interface MultiplayerReturnTrackView {
  completedDays: number;
  targetDays: number;
  bufferAvailable: boolean;
  days: Array<{ dateKey: string; visited: boolean }>;
}

interface MultiplayerContractTemplate {
  id: string;
  category: MultiplayerContractCategory;
  title: string;
  description: string;
  eventKinds: MultiplayerEngagementEventKind[];
  target: number;
  rewardGold: number;
  rewardExp: number;
  iconPath: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EVENT_RETENTION_MS = 15 * DAY_MS;
const RETURN_DAY_RETENTION_MS = 30 * DAY_MS;
export const MULTIPLAYER_ENGAGEMENT_VERSION = 2;
const VALID_EVENT_KINDS = new Set<MultiplayerEngagementEventKind>([
  'job-started',
  'job-completed',
  'travel-completed',
  'enemy-inspected',
  'battle-won',
  'battle-result-claimed',
  'story-quest-completed',
  'city-contract-completed',
  'boss-defeated',
  'dungeon-cleared',
  'chat-sent',
  'friend-action',
  'party-action',
  'trade-completed',
  'pvp-completed',
  'coop-completed',
  'social-action',
]);
const LEGACY_EVENT_KIND_MAP: Record<LegacyMultiplayerEngagementEventKind, MultiplayerEngagementEventKind> = {
  'battle-win': 'battle-result-claimed',
  'job-start': 'job-started',
  'dungeon-clear': 'dungeon-cleared',
};
const WEEKLY_CONTRIBUTION_KINDS: Record<MultiplayerContractCategory, Set<MultiplayerEngagementEventKind>> = {
  combat: new Set(['battle-result-claimed', 'dungeon-cleared', 'pvp-completed', 'coop-completed']),
  world: new Set(['job-started', 'story-quest-completed', 'city-contract-completed']),
  social: new Set(['social-action', 'chat-sent', 'friend-action', 'party-action', 'trade-completed']),
};
export const MULTIPLAYER_CONTRACT_CATEGORIES: MultiplayerContractCategory[] = ['combat', 'world', 'social'];

const CONTRACT_TEMPLATES: Record<MultiplayerContractCategory, MultiplayerContractTemplate[]> = {
  combat: [
    {
      id: 'combat-victory',
      category: 'combat',
      title: 'Road Victory',
      description: 'Win one world-map encounter and claim its battle report.',
      eventKinds: ['battle-result-claimed'],
      target: 1,
      rewardGold: 40,
      rewardExp: 25,
      iconPath: '/assets/icons/attack.png',
    },
    {
      id: 'combat-patrol',
      category: 'combat',
      title: 'Double Patrol',
      description: 'Win two world-map encounters before the board resets.',
      eventKinds: ['battle-result-claimed'],
      target: 2,
      rewardGold: 65,
      rewardExp: 40,
      iconPath: '/assets/icons/attack.png',
    },
  ],
  world: [
    {
      id: 'world-job',
      category: 'world',
      title: 'Sign a Road Order',
      description: 'Start one real job from a world work site.',
      eventKinds: ['job-started'],
      target: 1,
      rewardGold: 35,
      rewardExp: 25,
      iconPath: '/assets/icons/gold.png',
    },
    {
      id: 'world-workday',
      category: 'world',
      title: 'Working Road',
      description: 'Start two real jobs from world work sites.',
      eventKinds: ['job-started'],
      target: 2,
      rewardGold: 55,
      rewardExp: 35,
      iconPath: '/assets/icons/speed.png',
    },
  ],
  social: [
    {
      id: 'social-signal',
      category: 'social',
      title: 'Signal the Company',
      description: 'Send chat, answer a friend request, or complete a party action.',
      eventKinds: ['social-action', 'chat-sent', 'friend-action', 'party-action', 'trade-completed'],
      target: 1,
      rewardGold: 30,
      rewardExp: 25,
      iconPath: '/assets/icons/magic.png',
    },
    {
      id: 'social-network',
      category: 'social',
      title: 'Keep the Network',
      description: 'Complete two chat, friend, or party actions.',
      eventKinds: ['social-action', 'chat-sent', 'friend-action', 'party-action', 'trade-completed'],
      target: 2,
      rewardGold: 50,
      rewardExp: 35,
      iconPath: '/assets/icons/magic.png',
    },
  ],
};

const WEEKLY_OATHS = [
  {
    title: 'Oath of the Lantern Road',
    description: 'Contribute through combat, road work, or social actions. Any path advances the same oath.',
  },
  {
    title: 'Oath of the River Watch',
    description: 'Keep the shared roads active through victories, contracts, and company actions.',
  },
  {
    title: 'Oath of the Ashen Banner',
    description: 'Support the banner in whichever multiplayer activity fits your current level.',
  },
];

function hashText(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getMultiplayerDateKey(now = Date.now()): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateKeyToStart(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, Math.max(0, month - 1), day).getTime();
}

function shiftDateKey(dateKey: string, offsetDays: number): string {
  const date = new Date(dateKeyToStart(dateKey));
  date.setDate(date.getDate() + offsetDays);
  return getMultiplayerDateKey(date.getTime());
}

export function getMultiplayerWeekKey(now = Date.now()): string {
  const date = new Date(now);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - mondayOffset);
  return getMultiplayerDateKey(date.getTime());
}

function createContractVariants(username: string, dateKey: string): Record<MultiplayerContractCategory, number> {
  return {
    combat: hashText(`${username}:${dateKey}:combat`) % CONTRACT_TEMPLATES.combat.length,
    world: hashText(`${username}:${dateKey}:world`) % CONTRACT_TEMPLATES.world.length,
    social: hashText(`${username}:${dateKey}:social`) % CONTRACT_TEMPLATES.social.length,
  };
}

function normalizeTelemetry(value?: Partial<MultiplayerEngagementTelemetry>): MultiplayerEngagementTelemetry {
  return {
    eventsRecorded: Math.max(0, Math.floor(value?.eventsRecorded || 0)),
    dailyClaims: Math.max(0, Math.floor(value?.dailyClaims || 0)),
    dailyRerolls: Math.max(0, Math.floor(value?.dailyRerolls || 0)),
    weeklyClaims: Math.max(0, Math.floor(value?.weeklyClaims || 0)),
    briefingsShown: Math.max(0, Math.floor(value?.briefingsShown || 0)),
  };
}

function normalizeEventKind(value: unknown): MultiplayerEngagementEventKind | null {
  if (typeof value !== 'string') return null;
  if (VALID_EVENT_KINDS.has(value as MultiplayerEngagementEventKind)) {
    return value as MultiplayerEngagementEventKind;
  }
  return LEGACY_EVENT_KIND_MAP[value as LegacyMultiplayerEngagementEventKind] || null;
}

function normalizeOptionalEventId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().slice(0, 160);
  return normalized || undefined;
}

export function normalizeMultiplayerEngagementState(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  now = Date.now(),
): MultiplayerEngagementState {
  const dateKey = getMultiplayerDateKey(now);
  const weekKey = getMultiplayerWeekKey(now);
  const sameDate = state?.dateKey === dateKey;
  const sameWeek = state?.weekKey === weekKey;
  const generatedVariants = createContractVariants(username.trim().toLowerCase(), dateKey);
  const variants = sameDate ? state?.contractVariants : undefined;
  const normalizeVariant = (category: MultiplayerContractCategory) => {
    const value = variants?.[category];
    return Number.isInteger(value)
      ? Math.max(0, Number(value)) % CONTRACT_TEMPLATES[category].length
      : generatedVariants[category];
  };
  const seenEventIds = new Set<string>();
  const events = (state?.events || [])
    .map(event => {
      const kind = normalizeEventKind(event.kind);
      const id = normalizeOptionalEventId(event.id);
      if (!kind || !id || !Number.isFinite(event.occurredAt) || seenEventIds.has(id)) return null;
      seenEventIds.add(id);
      const normalizedEvent: MultiplayerEngagementEvent = {
        id,
        kind,
        occurredAt: event.occurredAt,
        recordedAt: Number.isFinite(event.recordedAt) ? event.recordedAt : event.occurredAt,
        actorUsername: normalizeOptionalEventId(event.actorUsername) || username.trim() || 'unknown',
      };
      const contextId = normalizeOptionalEventId(event.contextId);
      const targetId = normalizeOptionalEventId(event.targetId);
      if (contextId) normalizedEvent.contextId = contextId;
      if (targetId) normalizedEvent.targetId = targetId;
      return normalizedEvent;
    })
    .filter((event): event is MultiplayerEngagementEvent => Boolean(event))
    .filter(event => event.occurredAt >= now - EVENT_RETENTION_MS && event.occurredAt <= now + 60_000)
    .sort((left, right) => left.occurredAt - right.occurredAt)
    .slice(-160);
  const returnDays = Array.from(new Set((state?.returnDays || []).filter(value => (
    typeof value === 'string' && dateKeyToStart(value) >= now - RETURN_DAY_RETENTION_MS
  )))).sort();
  const pendingBriefing = state?.pendingBriefing
    && Number.isFinite(state.pendingBriefing.createdAt)
    && state.pendingBriefing.daysAway >= 3
    ? {
        daysAway: Math.max(3, Math.floor(state.pendingBriefing.daysAway)),
        createdAt: state.pendingBriefing.createdAt,
      }
    : undefined;

  return {
    version: MULTIPLAYER_ENGAGEMENT_VERSION,
    dateKey,
    weekKey,
    contractVariants: {
      combat: normalizeVariant('combat'),
      world: normalizeVariant('world'),
      social: normalizeVariant('social'),
    },
    claimedContractIds: sameDate
      ? Array.from(new Set((state?.claimedContractIds || []).filter(id => typeof id === 'string')))
      : [],
    rerollUsed: sameDate && Boolean(state?.rerollUsed),
    weeklyClaimed: sameWeek && Boolean(state?.weeklyClaimed),
    events,
    telemetry: normalizeTelemetry(state?.telemetry),
    returnDays,
    lastSeenAt: Number.isFinite(state?.lastSeenAt) ? state?.lastSeenAt : undefined,
    pendingBriefing,
  };
}

export function getMultiplayerDailyContracts(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  now = Date.now(),
): MultiplayerContractView[] {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  const dayStart = dateKeyToStart(normalized.dateKey);

  return MULTIPLAYER_CONTRACT_CATEGORIES.map(category => {
    const template = CONTRACT_TEMPLATES[category][normalized.contractVariants[category]];
    const id = `${normalized.dateKey}:${template.id}`;
    const progress = normalized.events.filter(event => (
      template.eventKinds.includes(event.kind) && event.occurredAt >= dayStart
    )).length;
    return {
      ...template,
      id,
      progress: Math.min(template.target, progress),
      complete: progress >= template.target,
      claimed: normalized.claimedContractIds.includes(id),
    };
  });
}

export function recordMultiplayerEngagementEvent(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  eventInput: MultiplayerEngagementEventInput | MultiplayerEngagementEventInputKind,
  now = Date.now(),
): MultiplayerEngagementState {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  const input = typeof eventInput === 'string' ? { kind: eventInput } : eventInput;
  const kind = normalizeEventKind(input.kind);
  if (!kind) return normalized;
  const sequence = normalized.telemetry.eventsRecorded + 1;
  const occurredAt = Number.isFinite(input.occurredAt) ? Number(input.occurredAt) : now;
  const id = normalizeOptionalEventId(input.id) || `${kind}-${occurredAt}-${sequence}`;
  if (normalized.events.some(event => event.id === id)) return normalized;

  return normalizeMultiplayerEngagementState({
    ...normalized,
    events: [...normalized.events, {
      id,
      kind,
      occurredAt,
      recordedAt: now,
      actorUsername: username.trim() || 'unknown',
      contextId: normalizeOptionalEventId(input.contextId),
      targetId: normalizeOptionalEventId(input.targetId),
    }],
    telemetry: { ...normalized.telemetry, eventsRecorded: sequence },
  }, username, now);
}

export function rerollMultiplayerDailyContract(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  contractId: string,
  now = Date.now(),
): { success: boolean; state: MultiplayerEngagementState; error?: string } {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  const contract = getMultiplayerDailyContracts(normalized, username, now).find(item => item.id === contractId);
  if (!contract) return { success: false, state: normalized, error: 'Daily contract not found.' };
  if (normalized.rerollUsed) return { success: false, state: normalized, error: 'The daily reroll was already used.' };
  if (contract.claimed || contract.complete) {
    return { success: false, state: normalized, error: 'Completed contracts cannot be rerolled.' };
  }

  return {
    success: true,
    state: normalizeMultiplayerEngagementState({
      ...normalized,
      contractVariants: {
        ...normalized.contractVariants,
        [contract.category]: (normalized.contractVariants[contract.category] + 1) % CONTRACT_TEMPLATES[contract.category].length,
      },
      rerollUsed: true,
      telemetry: { ...normalized.telemetry, dailyRerolls: normalized.telemetry.dailyRerolls + 1 },
    }, username, now),
  };
}

export function claimMultiplayerDailyContract(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  contractId: string,
  now = Date.now(),
): { success: boolean; state: MultiplayerEngagementState; contract?: MultiplayerContractView; error?: string } {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  const contract = getMultiplayerDailyContracts(normalized, username, now).find(item => item.id === contractId);
  if (!contract) return { success: false, state: normalized, error: 'Daily contract not found.' };
  if (contract.claimed) return { success: false, state: normalized, contract, error: 'Daily contract already claimed.' };
  if (!contract.complete) return { success: false, state: normalized, contract, error: 'Daily contract is not complete.' };

  return {
    success: true,
    contract,
    state: normalizeMultiplayerEngagementState({
      ...normalized,
      claimedContractIds: [...normalized.claimedContractIds, contract.id],
      telemetry: { ...normalized.telemetry, dailyClaims: normalized.telemetry.dailyClaims + 1 },
    }, username, now),
  };
}

export function getMultiplayerWeeklyOath(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  now = Date.now(),
): MultiplayerWeeklyOathView {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  const weekStart = dateKeyToStart(normalized.weekKey);
  const weeklyEvents = normalized.events.filter(event => event.occurredAt >= weekStart);
  const contributions = {
    combat: weeklyEvents.filter(event => WEEKLY_CONTRIBUTION_KINDS.combat.has(event.kind)).length,
    world: weeklyEvents.filter(event => WEEKLY_CONTRIBUTION_KINDS.world.has(event.kind)).length,
    social: weeklyEvents.filter(event => WEEKLY_CONTRIBUTION_KINDS.social.has(event.kind)).length,
  };
  const target = 8;
  const progress = contributions.combat + contributions.world + contributions.social;
  const oath = WEEKLY_OATHS[hashText(normalized.weekKey) % WEEKLY_OATHS.length];

  return {
    id: `${normalized.weekKey}:weekly-oath`,
    ...oath,
    target,
    progress: Math.min(target, progress),
    complete: progress >= target,
    claimed: normalized.weeklyClaimed,
    rewardGold: 180,
    rewardExp: 75,
    contributions,
  };
}

export function claimMultiplayerWeeklyOath(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  now = Date.now(),
): { success: boolean; state: MultiplayerEngagementState; oath: MultiplayerWeeklyOathView; error?: string } {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  const oath = getMultiplayerWeeklyOath(normalized, username, now);
  if (oath.claimed) return { success: false, state: normalized, oath, error: 'Weekly oath already claimed.' };
  if (!oath.complete) return { success: false, state: normalized, oath, error: 'Weekly oath is not complete.' };

  return {
    success: true,
    oath,
    state: normalizeMultiplayerEngagementState({
      ...normalized,
      weeklyClaimed: true,
      telemetry: { ...normalized.telemetry, weeklyClaims: normalized.telemetry.weeklyClaims + 1 },
    }, username, now),
  };
}

export function touchMultiplayerEngagement(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  now = Date.now(),
): MultiplayerEngagementState {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  const today = normalized.dateKey;
  const previousDate = normalized.lastSeenAt ? getMultiplayerDateKey(normalized.lastSeenAt) : null;
  if (previousDate === today && normalized.returnDays.includes(today)) return normalized;

  const gapDays = previousDate
    ? Math.max(0, Math.round((dateKeyToStart(today) - dateKeyToStart(previousDate)) / DAY_MS))
    : 0;
  const daysAway = Math.max(0, gapDays - 1);
  const shouldBrief = daysAway >= 3 && !normalized.pendingBriefing;

  return normalizeMultiplayerEngagementState({
    ...normalized,
    returnDays: [...normalized.returnDays, today],
    lastSeenAt: now,
    pendingBriefing: shouldBrief ? { daysAway, createdAt: now } : normalized.pendingBriefing,
    telemetry: shouldBrief
      ? { ...normalized.telemetry, briefingsShown: normalized.telemetry.briefingsShown + 1 }
      : normalized.telemetry,
  }, username, now);
}

export function dismissMultiplayerReturningBriefing(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  now = Date.now(),
): MultiplayerEngagementState {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  return { ...normalized, pendingBriefing: undefined };
}

export function getMultiplayerReturnTrack(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  now = Date.now(),
): MultiplayerReturnTrackView {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  const days = Array.from({ length: 8 }, (_, index) => {
    const dateKey = shiftDateKey(normalized.dateKey, index - 7);
    return { dateKey, visited: normalized.returnDays.includes(dateKey) };
  });
  const visitedCount = days.filter(day => day.visited).length;

  return {
    completedDays: Math.min(7, visitedCount),
    targetDays: 7,
    bufferAvailable: days.filter(day => !day.visited).length <= 1,
    days,
  };
}

export function getMultiplayerEngagementClaimableCount(
  state: Partial<MultiplayerEngagementState> | null | undefined,
  username: string,
  now = Date.now(),
): number {
  const daily = getMultiplayerDailyContracts(state, username, now)
    .filter(contract => contract.complete && !contract.claimed).length;
  const weekly = getMultiplayerWeeklyOath(state, username, now);
  return daily + (weekly.complete && !weekly.claimed ? 1 : 0);
}
