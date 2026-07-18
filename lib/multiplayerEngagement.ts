export type MultiplayerContractCategory = 'combat' | 'world' | 'social';
export type MultiplayerEngagementEventKind = 'battle-win' | 'job-start' | 'social-action' | 'dungeon-clear';

export interface MultiplayerEngagementEvent {
  id: string;
  kind: MultiplayerEngagementEventKind;
  occurredAt: number;
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
  eventKind: MultiplayerEngagementEventKind;
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
  eventKind: MultiplayerEngagementEventKind;
  target: number;
  rewardGold: number;
  rewardExp: number;
  iconPath: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EVENT_RETENTION_MS = 15 * DAY_MS;
const RETURN_DAY_RETENTION_MS = 30 * DAY_MS;
const VALID_EVENT_KINDS = new Set<MultiplayerEngagementEventKind>([
  'battle-win',
  'job-start',
  'social-action',
  'dungeon-clear',
]);
export const MULTIPLAYER_CONTRACT_CATEGORIES: MultiplayerContractCategory[] = ['combat', 'world', 'social'];

const CONTRACT_TEMPLATES: Record<MultiplayerContractCategory, MultiplayerContractTemplate[]> = {
  combat: [
    {
      id: 'combat-victory',
      category: 'combat',
      title: 'Road Victory',
      description: 'Win one world-map encounter and claim its battle report.',
      eventKind: 'battle-win',
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
      eventKind: 'battle-win',
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
      eventKind: 'job-start',
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
      eventKind: 'job-start',
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
      eventKind: 'social-action',
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
      eventKind: 'social-action',
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
  const events = (state?.events || [])
    .filter(event => VALID_EVENT_KINDS.has(event.kind) && Number.isFinite(event.occurredAt))
    .filter(event => event.occurredAt >= now - EVENT_RETENTION_MS && event.occurredAt <= now + 60_000)
    .map(event => ({ id: String(event.id), kind: event.kind, occurredAt: event.occurredAt }))
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
      event.kind === template.eventKind && event.occurredAt >= dayStart
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
  kind: MultiplayerEngagementEventKind,
  now = Date.now(),
): MultiplayerEngagementState {
  const normalized = normalizeMultiplayerEngagementState(state, username, now);
  const sequence = normalized.telemetry.eventsRecorded + 1;
  return normalizeMultiplayerEngagementState({
    ...normalized,
    events: [...normalized.events, { id: `${kind}-${now}-${sequence}`, kind, occurredAt: now }],
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
    combat: weeklyEvents.filter(event => event.kind === 'battle-win' || event.kind === 'dungeon-clear').length,
    world: weeklyEvents.filter(event => event.kind === 'job-start').length,
    social: weeklyEvents.filter(event => event.kind === 'social-action').length,
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
