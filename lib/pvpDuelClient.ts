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

const PVP_DUEL_SESSIONS_KEY = 'pirate_game_pvp_duel_sessions';
export const PVP_DUEL_SESSION_UPDATED_EVENT = 'pirate-game:pvp-duel-session-updated';

function emitDuelSessionUpdated(session: PvpDuelSession): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PVP_DUEL_SESSION_UPDATED_EVENT, {
    detail: { sessionId: session.id, version: session.version },
  }));
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

export function ensurePvpDuelSession(
  challengeOrId: BattleChallenge | string,
  now = Date.now(),
): PvpDuelSessionResult {
  const challenge = typeof challengeOrId === 'string'
    ? getBattleChallenges().find(item => item.id === challengeOrId)
    : challengeOrId;
  if (!challenge) return { success: false, error: 'Duel challenge was not found.' };

  const existing = getPvpDuelSessions(now).find(session => session.challengeId === challenge.id);
  if (existing) return { success: true, session: existing, duplicate: true };

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

export function confirmCurrentPvpDuelFormation(
  sessionId: string,
  username: string,
  placements: Record<string, { x: number; y: number }>,
  equippedSpellIds: string[],
  expectedVersion: number,
  now = Date.now(),
): PvpDuelSessionResult {
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
  const session = getPvpDuelSessions(now).find(item => item.id === sessionId);
  if (!session) return { success: false, error: 'Duel session was not found.' };
  const result = applyPvpDuelAction(session, action, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: savePvpDuelSession(result.session, now) };
}

export function forfeitCurrentPvpDuelSession(
  sessionId: string,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): PvpDuelSessionResult {
  const session = getPvpDuelSessions(now).find(item => item.id === sessionId);
  if (!session) return { success: false, error: 'Duel session was not found.' };
  const result = forfeitPvpDuelSession(session, username, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: savePvpDuelSession(result.session, now) };
}

export function cancelCurrentPvpDuelSession(
  sessionId: string,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): PvpDuelSessionResult {
  const session = getPvpDuelSessions(now).find(item => item.id === sessionId);
  if (!session) return { success: false, error: 'Duel session was not found.' };
  const result = cancelPvpDuelSession(session, username, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: savePvpDuelSession(result.session, now) };
}

export function settleCurrentPvpDuelSession(
  sessionId: string,
  now = Date.now(),
): PvpDuelSessionResult {
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
  const marked = markPvpDuelRatingApplied(session, now);
  if (!marked.success || !marked.session) return marked;
  return { ...marked, session: savePvpDuelSession(marked.session, now) };
}
