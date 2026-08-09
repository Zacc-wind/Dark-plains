'use client';

import {
  getUsers,
  recordPvpDuelOutcome,
} from './auth';
import {
  getBattleChallenges,
  type BattleChallenge,
  type SynchronizedBattleAction,
} from './battle';
import { readGameJson, writeGameJson } from './gameStore';
import {
  applyPvpDuelAction,
  cancelPvpDuelSession,
  confirmPvpDuelFormation,
  createPvpDuelSession,
  forfeitPvpDuelSession,
  getPvpDuelSide,
  markPvpDuelRatingApplied,
  normalizePvpDuelSessions,
  type PvpDuelSession,
  type PvpDuelSessionResult,
} from './pvpDuelSessions';
import {
  createOnlinePvpDuelSession,
  fetchOnlinePvpDuelSessions,
  shouldUseOnlinePvpDuelClient,
  updateOnlinePvpDuelSession,
} from './pvpDuelOnlineClient';

const PVP_DUEL_SESSIONS_KEY = 'pirate_game_pvp_duel_sessions';
export const PVP_DUEL_SESSION_UPDATED_EVENT = 'pirate-game:pvp-duel-session-updated';

function emitDuelSessionUpdated(session: PvpDuelSession): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PVP_DUEL_SESSION_UPDATED_EVENT, {
    detail: { sessionId: session.id, version: session.version },
  }));
}

function onlineError(error: unknown, fallback: string): PvpDuelSessionResult {
  const conflict = error as Error & { session?: PvpDuelSession; conflict?: boolean };
  if (conflict?.conflict && conflict.session) {
    savePvpDuelSession(conflict.session);
    return { success: false, session: conflict.session, error: conflict.message || fallback };
  }
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

export function getPvpDuelSessions(now = Date.now()): PvpDuelSession[] {
  return normalizePvpDuelSessions(
    readGameJson<PvpDuelSession[]>(PVP_DUEL_SESSIONS_KEY, []),
    now,
  );
}

export function savePvpDuelSession(session: PvpDuelSession, now = Date.now()): PvpDuelSession {
  const sessions = normalizePvpDuelSessions([
    session,
    ...getPvpDuelSessions(now).filter(existing => existing.id !== session.id),
  ], now);
  writeGameJson(PVP_DUEL_SESSIONS_KEY, sessions);
  const saved = sessions.find(existing => existing.id === session.id) || session;
  emitDuelSessionUpdated(saved);
  return saved;
}

export function getCurrentPvpDuelSession(
  username: string,
  now = Date.now(),
): PvpDuelSession | undefined {
  const sessions = getPvpDuelSessions(now)
    .filter(session => getPvpDuelSide(session, username));
  return sessions.find(session => session.phase === 'active')
    || sessions.find(session => session.phase === 'formation')
    || sessions.find(session => session.phase === 'completed' && !session.result?.ratingApplied);
}

export async function ensurePvpDuelSession(
  challengeOrId: BattleChallenge | string,
  now = Date.now(),
): Promise<PvpDuelSessionResult> {
  const challenge = typeof challengeOrId === 'string'
    ? getBattleChallenges().find(item => item.id === challengeOrId)
    : challengeOrId;
  if (!challenge) return { success: false, error: 'Duel challenge was not found.' };

  const existing = getPvpDuelSessions(now).find(session => session.challengeId === challenge.id);
  if (existing) return { success: true, session: existing, duplicate: true };

  if (shouldUseOnlinePvpDuelClient()) {
    try {
      const payload = await createOnlinePvpDuelSession(challenge.id);
      return {
        success: true,
        session: savePvpDuelSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to create online duel session.');
    }
  }

  const users = getUsers();
  const challenger = users.find(user => user.username.toLowerCase() === challenge.challengerUsername.toLowerCase());
  const defender = users.find(user => user.username.toLowerCase() === challenge.targetUsername.toLowerCase());
  if (!challenger || !defender) {
    return { success: false, error: 'Both full player profiles are required to create a local duel session.' };
  }

  const created = createPvpDuelSession(challenge, challenger, defender, now);
  if (!created.success || !created.session) return created;
  return { ...created, session: savePvpDuelSession(created.session, now) };
}

export async function syncOnlinePvpDuelSessions(now = Date.now()): Promise<void> {
  if (!shouldUseOnlinePvpDuelClient()) return;
  try {
    const sessions = await fetchOnlinePvpDuelSessions();
    sessions.forEach(session => {
      savePvpDuelSession(session, now);
    });
  } catch {
    // Keep local cache if sync fails.
  }
}

export async function confirmCurrentPvpDuelFormation(
  sessionId: string,
  username: string,
  placements: Record<string, { x: number; y: number }>,
  equippedSpellIds: string[],
  expectedVersion: number,
  now = Date.now(),
): Promise<PvpDuelSessionResult> {
  if (shouldUseOnlinePvpDuelClient()) {
    try {
      const payload = await updateOnlinePvpDuelSession(sessionId, {
        action: 'confirm_formation',
        expectedVersion,
        placements,
        equippedSpellIds,
      });
      return {
        success: true,
        session: savePvpDuelSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to confirm duel formation.');
    }
  }

  const session = getPvpDuelSessions(now).find(item => item.id === sessionId);
  if (!session) return { success: false, error: 'Duel session was not found.' };
  const result = confirmPvpDuelFormation(
    session,
    username,
    placements,
    equippedSpellIds,
    expectedVersion,
    now,
  );
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: savePvpDuelSession(result.session, now) };
}

export function applyCurrentPvpDuelAction(
  sessionId: string,
  action: SynchronizedBattleAction,
  expectedVersion: number,
  now = Date.now(),
): PvpDuelSessionResult {
  // Combat action streaming stays local for this slice.
  const session = getPvpDuelSessions(now).find(item => item.id === sessionId);
  if (!session) return { success: false, error: 'Duel session was not found.' };
  const result = applyPvpDuelAction(session, action, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: savePvpDuelSession(result.session, now) };
}

export async function forfeitCurrentPvpDuelSession(
  sessionId: string,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): Promise<PvpDuelSessionResult> {
  if (shouldUseOnlinePvpDuelClient()) {
    try {
      const payload = await updateOnlinePvpDuelSession(sessionId, {
        action: 'forfeit',
        expectedVersion,
      });
      return {
        success: true,
        session: savePvpDuelSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to forfeit duel.');
    }
  }

  const session = getPvpDuelSessions(now).find(item => item.id === sessionId);
  if (!session) return { success: false, error: 'Duel session was not found.' };
  const result = forfeitPvpDuelSession(session, username, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: savePvpDuelSession(result.session, now) };
}

export async function cancelCurrentPvpDuelSession(
  sessionId: string,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): Promise<PvpDuelSessionResult> {
  if (shouldUseOnlinePvpDuelClient()) {
    try {
      const payload = await updateOnlinePvpDuelSession(sessionId, {
        action: 'cancel',
        expectedVersion,
      });
      return {
        success: true,
        session: savePvpDuelSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to cancel duel.');
    }
  }

  const session = getPvpDuelSessions(now).find(item => item.id === sessionId);
  if (!session) return { success: false, error: 'Duel session was not found.' };
  const result = cancelPvpDuelSession(session, username, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: savePvpDuelSession(result.session, now) };
}

export async function settleCurrentPvpDuelSession(
  sessionId: string,
  now = Date.now(),
): Promise<PvpDuelSessionResult> {
  const session = getPvpDuelSessions(now).find(item => item.id === sessionId);
  if (!session) return { success: false, error: 'Duel session was not found.' };
  if (session.phase !== 'completed' || !session.result) {
    return { success: false, session, error: 'Duel result is not ready.' };
  }
  if (session.result.ratingApplied) return { success: true, session, duplicate: true };

  const rating = recordPvpDuelOutcome(
    session.result.winnerUsername,
    session.result.loserUsername,
    session.id,
    now,
  );
  if (!rating.success) return { success: false, session, error: 'Could not apply the duel rating result.' };

  if (shouldUseOnlinePvpDuelClient()) {
    try {
      const payload = await updateOnlinePvpDuelSession(sessionId, {
        action: 'settle',
        expectedVersion: session.version,
      });
      return {
        success: true,
        session: savePvpDuelSession(payload.session, now),
        duplicate: payload.duplicate || rating.duplicate,
      };
    } catch (error) {
      // Rating already applied locally; keep local mark so settlement is not retried forever.
      const marked = markPvpDuelRatingApplied(session, now);
      if (marked.success && marked.session) {
        return { ...marked, session: savePvpDuelSession(marked.session, now) };
      }
      return onlineError(error, 'Failed to settle online duel.');
    }
  }

  const marked = markPvpDuelRatingApplied(session, now);
  if (!marked.success || !marked.session) return marked;
  return { ...marked, session: savePvpDuelSession(marked.session, now) };
}
