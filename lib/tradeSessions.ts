export type TradeSessionStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'expired';
export type TradeSessionSide = 'initiator' | 'receiver';

export interface TradeItemOffer {
  itemId: string;
  quantity: number;
}

export interface TradeOffer {
  gold: number;
  items: TradeItemOffer[];
  equipmentIds: string[];
}

export interface TradeSession {
  id: string;
  initiatorUsername: string;
  receiverUsername: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  status: TradeSessionStatus;
  version: number;
  initiatorOffer: TradeOffer;
  receiverOffer: TradeOffer;
  initiatorLocked: boolean;
  receiverLocked: boolean;
  initiatorAccepted: boolean;
  receiverAccepted: boolean;
  completedAt?: number;
  cancelledBy?: string;
}

export const TRADE_REQUEST_TTL_MS = 2 * 60 * 1000;
export const TRADE_SESSION_TTL_MS = 30 * 60 * 1000;
export const TRADE_SESSION_OPEN_EVENT = 'pirate-game:open-trade-session';
const TRADE_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const VALID_STATUSES = new Set<TradeSessionStatus>(['pending', 'active', 'completed', 'cancelled', 'expired']);

function normalizeUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 40) : '';
}

function normalizeOffer(value: Partial<TradeOffer> | null | undefined): TradeOffer {
  const itemQuantities = new Map<string, number>();
  (value?.items || []).forEach(item => {
    const itemId = typeof item?.itemId === 'string' ? item.itemId.trim().slice(0, 120) : '';
    const quantity = Math.min(999, Math.max(0, Math.floor(Number(item?.quantity) || 0)));
    if (!itemId || quantity <= 0) return;
    itemQuantities.set(itemId, Math.min(999, (itemQuantities.get(itemId) || 0) + quantity));
  });

  const equipmentIds = Array.from(new Set((value?.equipmentIds || [])
    .filter(id => typeof id === 'string')
    .map(id => id.trim().slice(0, 160))
    .filter(Boolean)))
    .slice(0, 20);

  return {
    gold: Math.min(2_000_000_000, Math.max(0, Math.floor(Number(value?.gold) || 0))),
    items: Array.from(itemQuantities, ([itemId, quantity]) => ({ itemId, quantity }))
      .sort((left, right) => left.itemId.localeCompare(right.itemId)),
    equipmentIds,
  };
}

export function emptyTradeOffer(): TradeOffer {
  return { gold: 0, items: [], equipmentIds: [] };
}

export function normalizeTradeSessions(
  sessions: readonly Partial<TradeSession>[] | null | undefined,
  now = Date.now(),
): TradeSession[] {
  const seenIds = new Set<string>();
  const normalized: TradeSession[] = [];

  (sessions || []).forEach(session => {
    const id = typeof session.id === 'string' ? session.id.trim().slice(0, 180) : '';
    const initiatorUsername = normalizeUsername(session.initiatorUsername);
    const receiverUsername = normalizeUsername(session.receiverUsername);
    if (!id || !initiatorUsername || !receiverUsername || seenIds.has(id)) return;

    const createdAt = Number.isFinite(session.createdAt) ? Number(session.createdAt) : now;
    const updatedAt = Number.isFinite(session.updatedAt) ? Number(session.updatedAt) : createdAt;
    const expiresAt = Number.isFinite(session.expiresAt)
      ? Math.max(createdAt, Number(session.expiresAt))
      : createdAt + TRADE_REQUEST_TTL_MS;
    const rawStatus = VALID_STATUSES.has(session.status as TradeSessionStatus)
      ? session.status as TradeSessionStatus
      : 'pending';
    if (expiresAt < now - TRADE_SESSION_RETENTION_MS) return;

    const status = (rawStatus === 'pending' || rawStatus === 'active') && expiresAt <= now
      ? 'expired'
      : rawStatus;
    seenIds.add(id);
    normalized.push({
      id,
      initiatorUsername,
      receiverUsername,
      createdAt,
      updatedAt,
      expiresAt,
      status,
      version: Math.max(1, Math.floor(Number(session.version) || 1)),
      initiatorOffer: normalizeOffer(session.initiatorOffer),
      receiverOffer: normalizeOffer(session.receiverOffer),
      initiatorLocked: status === 'active' && Boolean(session.initiatorLocked),
      receiverLocked: status === 'active' && Boolean(session.receiverLocked),
      initiatorAccepted: status === 'active' && Boolean(session.initiatorAccepted),
      receiverAccepted: status === 'active' && Boolean(session.receiverAccepted),
      ...(Number.isFinite(session.completedAt) ? { completedAt: Number(session.completedAt) } : {}),
      ...(normalizeUsername(session.cancelledBy) ? { cancelledBy: normalizeUsername(session.cancelledBy) } : {}),
    });
  });

  return normalized.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 20);
}

export function createTradeSession(
  initiatorUsername: string,
  receiverUsername: string,
  now = Date.now(),
): TradeSession {
  const initiator = initiatorUsername.trim();
  const receiver = receiverUsername.trim();
  return {
    id: `trade-session-${initiator.toLowerCase()}-${receiver.toLowerCase()}-${now}`,
    initiatorUsername: initiator,
    receiverUsername: receiver,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + TRADE_REQUEST_TTL_MS,
    status: 'pending',
    version: 1,
    initiatorOffer: emptyTradeOffer(),
    receiverOffer: emptyTradeOffer(),
    initiatorLocked: false,
    receiverLocked: false,
    initiatorAccepted: false,
    receiverAccepted: false,
  };
}

export function getTradeSessionSide(session: TradeSession, username: string): TradeSessionSide | null {
  const normalized = username.trim().toLowerCase();
  if (session.initiatorUsername.toLowerCase() === normalized) return 'initiator';
  if (session.receiverUsername.toLowerCase() === normalized) return 'receiver';
  return null;
}

export function getTradeOffer(session: TradeSession, username: string): TradeOffer | null {
  const side = getTradeSessionSide(session, username);
  return side === 'initiator' ? session.initiatorOffer : side === 'receiver' ? session.receiverOffer : null;
}

export function activateTradeSession(
  session: TradeSession,
  receiverUsername: string,
  now = Date.now(),
): { success: boolean; session: TradeSession; error?: string } {
  const normalized = normalizeTradeSessions([session], now)[0];
  if (!normalized || normalized.status !== 'pending') {
    return { success: false, session: normalized || session, error: 'Trade request is no longer pending.' };
  }
  if (getTradeSessionSide(normalized, receiverUsername) !== 'receiver') {
    return { success: false, session: normalized, error: 'Only the invited player can open this trade.' };
  }
  return {
    success: true,
    session: {
      ...normalized,
      status: 'active',
      updatedAt: now,
      expiresAt: now + TRADE_SESSION_TTL_MS,
      version: normalized.version + 1,
    },
  };
}

export function updateTradeSessionOffer(
  session: TradeSession,
  username: string,
  offer: Partial<TradeOffer>,
  now = Date.now(),
): { success: boolean; session: TradeSession; error?: string } {
  const normalized = normalizeTradeSessions([session], now)[0];
  const side = normalized ? getTradeSessionSide(normalized, username) : null;
  if (!normalized || normalized.status !== 'active') {
    return { success: false, session: normalized || session, error: 'Trade session is not active.' };
  }
  if (!side) return { success: false, session: normalized, error: 'Player is not part of this trade.' };
  if (side === 'initiator' ? normalized.initiatorLocked : normalized.receiverLocked) {
    return { success: false, session: normalized, error: 'Unlock your offer before changing it.' };
  }

  return {
    success: true,
    session: {
      ...normalized,
      ...(side === 'initiator' ? { initiatorOffer: normalizeOffer(offer) } : { receiverOffer: normalizeOffer(offer) }),
      initiatorLocked: false,
      receiverLocked: false,
      initiatorAccepted: false,
      receiverAccepted: false,
      updatedAt: now,
      expiresAt: now + TRADE_SESSION_TTL_MS,
      version: normalized.version + 1,
    },
  };
}

export function setTradeSessionLock(
  session: TradeSession,
  username: string,
  locked: boolean,
  now = Date.now(),
): { success: boolean; session: TradeSession; error?: string } {
  const normalized = normalizeTradeSessions([session], now)[0];
  const side = normalized ? getTradeSessionSide(normalized, username) : null;
  if (!normalized || normalized.status !== 'active') {
    return { success: false, session: normalized || session, error: 'Trade session is not active.' };
  }
  if (!side) return { success: false, session: normalized, error: 'Player is not part of this trade.' };

  return {
    success: true,
    session: {
      ...normalized,
      ...(side === 'initiator' ? { initiatorLocked: locked } : { receiverLocked: locked }),
      initiatorAccepted: locked ? normalized.initiatorAccepted : false,
      receiverAccepted: locked ? normalized.receiverAccepted : false,
      updatedAt: now,
      expiresAt: now + TRADE_SESSION_TTL_MS,
      version: normalized.version + 1,
    },
  };
}

export function confirmTradeSession(
  session: TradeSession,
  username: string,
  now = Date.now(),
): { success: boolean; readyToComplete: boolean; session: TradeSession; error?: string } {
  const normalized = normalizeTradeSessions([session], now)[0];
  const side = normalized ? getTradeSessionSide(normalized, username) : null;
  if (!normalized || normalized.status !== 'active') {
    return { success: false, readyToComplete: false, session: normalized || session, error: 'Trade session is not active.' };
  }
  if (!side) return { success: false, readyToComplete: false, session: normalized, error: 'Player is not part of this trade.' };
  if (!normalized.initiatorLocked || !normalized.receiverLocked) {
    return { success: false, readyToComplete: false, session: normalized, error: 'Both offers must be locked first.' };
  }

  const nextSession: TradeSession = {
    ...normalized,
    ...(side === 'initiator' ? { initiatorAccepted: true } : { receiverAccepted: true }),
    updatedAt: now,
    expiresAt: now + TRADE_SESSION_TTL_MS,
    version: normalized.version + 1,
  };
  return {
    success: true,
    readyToComplete: nextSession.initiatorAccepted && nextSession.receiverAccepted,
    session: nextSession,
  };
}

export function setTradeSessionStatus(
  session: TradeSession,
  status: Extract<TradeSessionStatus, 'completed' | 'cancelled' | 'expired'>,
  now = Date.now(),
  cancelledBy?: string,
): TradeSession {
  return {
    ...session,
    status,
    updatedAt: now,
    version: session.version + 1,
    initiatorLocked: false,
    receiverLocked: false,
    initiatorAccepted: false,
    receiverAccepted: false,
    ...(status === 'completed' ? { completedAt: now } : {}),
    ...(status === 'cancelled' && cancelledBy ? { cancelledBy } : {}),
  };
}

export function getCurrentTradeSession(
  sessions: readonly Partial<TradeSession>[] | null | undefined,
  username: string,
  now = Date.now(),
): TradeSession | undefined {
  const normalized = username.trim().toLowerCase();
  return normalizeTradeSessions(sessions, now).find(session => (
    (session.status === 'active' || session.status === 'pending')
    && (session.initiatorUsername.toLowerCase() === normalized || session.receiverUsername.toLowerCase() === normalized)
  ));
}
