'use client';

import {
  getCurrentUser,
  getPartyMembers,
  getSocialState,
  type User,
} from './auth';
import type { SynchronizedBattleAction } from './battle';
import {
  abandonCoopDungeonSession,
  applyCoopDungeonAction,
  createCoopDungeonSession,
  getCoopDungeonMemberRole,
  normalizeCoopDungeonSessions,
  startCoopDungeonChamber,
  type CoopDungeonSession,
  type CoopDungeonSessionResult,
} from './coopDungeonSessions';
import {
  createOnlineCoopDungeonSession,
  fetchOnlineCoopDungeonSessions,
  postOnlineCoopDungeonAction,
  shouldUseOnlineCoopDungeonClient,
  updateOnlineCoopDungeonSession,
} from './coopDungeonOnlineClient';
import { readGameJson, writeGameJson } from './gameStore';
import { getMultiplayerUnlockStatus } from './multiplayerUnlocks';
import { getActiveDungeons, type WorldDungeon } from './worldEvents';

const COOP_DUNGEON_SESSIONS_KEY = 'pirate_game_coop_dungeon_sessions';
export const COOP_DUNGEON_SESSION_UPDATED_EVENT = 'pirate-game:coop-dungeon-session-updated';

export type CanPrepareCoopDungeonResult =
  | { ok: true; resumeDungeonId?: string }
  | { ok: false; reason: string };

/**
 * PVE hub entry guard for duo dungeon routes.
 * Same unlock/party readiness as duo raids (coop-dungeons + duo party + leader).
 */
export function canPrepareCoopDungeon(
  user: User | null,
  now = Date.now(),
): CanPrepareCoopDungeonResult {
  if (!user) return { ok: false, reason: 'Login required.' };

  const current = getCurrentCoopDungeonSession(user.username, now);
  if (current) {
    return { ok: true, resumeDungeonId: current.dungeonId };
  }

  const coopUnlock = getMultiplayerUnlockStatus('coop-dungeons', user);
  if (!coopUnlock.unlocked) {
    return {
      ok: false,
      reason: `${coopUnlock.title} unlocks at level ${coopUnlock.minLevel}.`,
    };
  }

  const party = getSocialState(user).party;
  if (!party) {
    return {
      ok: false,
      reason: 'Create a party and invite one commander from Chat.',
    };
  }

  const partyMembers = getPartyMembers(user);
  if (partyMembers.length !== 2) {
    return {
      ok: false,
      reason: 'Duo dungeon routes require exactly two accepted party members.',
    };
  }

  if (party.leaderUsername.toLowerCase() !== user.username.toLowerCase()) {
    return {
      ok: false,
      reason: `${party.leaderUsername} must open the dungeon route.`,
    };
  }

  return { ok: true };
}

function emitSessionUpdated(session: CoopDungeonSession): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(COOP_DUNGEON_SESSION_UPDATED_EVENT, {
    detail: { sessionId: session.id, version: session.version },
  }));
}

function onlineError(error: unknown, fallback: string): CoopDungeonSessionResult {
  const conflict = error as Error & { session?: CoopDungeonSession; conflict?: boolean };
  if (conflict?.conflict && conflict.session) {
    saveCoopDungeonSession(conflict.session);
    return { success: false, session: conflict.session, error: conflict.message || fallback };
  }
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

export function getCoopDungeonSessions(now = Date.now()): CoopDungeonSession[] {
  return normalizeCoopDungeonSessions(
    readGameJson<CoopDungeonSession[]>(COOP_DUNGEON_SESSIONS_KEY, []),
    now,
  );
}

export function saveCoopDungeonSession(
  session: CoopDungeonSession,
  now = Date.now(),
): CoopDungeonSession {
  const sessions = normalizeCoopDungeonSessions([
    session,
    ...getCoopDungeonSessions(now).filter(existing => existing.id !== session.id),
  ], now);
  writeGameJson(COOP_DUNGEON_SESSIONS_KEY, sessions);
  const saved = sessions.find(existing => existing.id === session.id) || session;
  emitSessionUpdated(saved);
  return saved;
}

export function getCurrentCoopDungeonSession(
  username: string,
  now = Date.now(),
): CoopDungeonSession | undefined {
  const sessions = getCoopDungeonSessions(now).filter(session => (
    getCoopDungeonMemberRole(session, username)
  ));
  return sessions.find(session => session.phase === 'chamber')
    || sessions.find(session => session.phase === 'lobby')
    || sessions.find(session => session.phase === 'complete');
}

export async function syncOnlineCoopDungeonSessions(now = Date.now()): Promise<void> {
  if (!shouldUseOnlineCoopDungeonClient()) return;
  try {
    const sessions = await fetchOnlineCoopDungeonSessions();
    sessions.forEach(session => {
      saveCoopDungeonSession(session, now);
    });
  } catch {
    // Keep local cache if sync fails.
  }
}

function getStoredSession(sessionId: string, now: number): CoopDungeonSession | undefined {
  return getCoopDungeonSessions(now).find(session => session.id === sessionId);
}

function requireCurrentActor(username: string): { allowed: true } | { allowed: false; error: string } {
  const current = getCurrentUser();
  if (!current) return { allowed: false, error: 'Login required.' };
  if (current.username.toLowerCase() !== username.toLowerCase()) {
    return { allowed: false, error: 'Dungeon commands must come from the current account.' };
  }
  return { allowed: true };
}

function resolveDungeon(
  dungeonId: string | undefined,
  user: User,
  now: number,
): WorldDungeon | null {
  const dungeons = getActiveDungeons(now, user.stats.level || 1);
  if (dungeonId) {
    return dungeons.find(candidate => candidate.id === dungeonId) || null;
  }
  return dungeons[0] || null;
}

export async function ensureCurrentCoopDungeonSession(
  dungeonId?: string,
  now = Date.now(),
): Promise<CoopDungeonSessionResult> {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const party = getSocialState(current).party;
  if (!party) return { success: false, error: 'Create a two-commander party first.' };

  const existing = getCoopDungeonSessions(now).find(session => (
    getCoopDungeonMemberRole(session, current.username)
    && session.phase !== 'abandoned'
    && (!dungeonId || session.dungeonId === dungeonId)
  ));
  if (existing) {
    if (existing.phase === 'complete') {
      emitSessionUpdated(existing);
      return { success: true, session: existing, duplicate: true };
    }
    emitSessionUpdated(existing);
    return { success: true, session: existing, duplicate: true };
  }

  const readiness = canPrepareCoopDungeon(current, now);
  if (!readiness.ok) return { success: false, error: readiness.reason };

  if (party.leaderUsername.toLowerCase() !== current.username.toLowerCase()) {
    return { success: false, error: 'Only the party leader can open a dungeon route.' };
  }

  const members = getPartyMembers(current);
  if (members.length !== 2) {
    return { success: false, error: 'Duo dungeon routes require exactly two accepted party members.' };
  }
  const host = members.find(member => member.username.toLowerCase() === party.leaderUsername.toLowerCase());
  const ally = members.find(member => member.username.toLowerCase() !== party.leaderUsername.toLowerCase());
  if (!host || !ally) {
    return { success: false, error: 'Both party profiles are required to open the route.' };
  }

  if (shouldUseOnlineCoopDungeonClient()) {
    try {
      const payload = await createOnlineCoopDungeonSession(dungeonId, ally.username);
      return {
        success: true,
        session: saveCoopDungeonSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to create online dungeon session.');
    }
  }

  const dungeon = resolveDungeon(dungeonId, host, now);
  if (!dungeon) {
    return { success: false, error: 'No active dungeon is available for a duo route.' };
  }

  const created = createCoopDungeonSession(party, host, ally, dungeon, now);
  if (!created.success || !created.session) return created;
  return { ...created, session: saveCoopDungeonSession(created.session, now) };
}

export async function startCurrentCoopDungeonChamber(
  sessionId: string,
  expectedVersion: number,
  now = Date.now(),
): Promise<CoopDungeonSessionResult> {
  if (shouldUseOnlineCoopDungeonClient()) {
    try {
      const payload = await updateOnlineCoopDungeonSession(sessionId, {
        action: 'start_chamber',
        expectedVersion,
      });
      return {
        success: true,
        session: saveCoopDungeonSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to start dungeon chamber.');
    }
  }

  const session = getStoredSession(sessionId, now);
  if (!session) return { success: false, error: 'Dungeon session was not found.' };
  const result = startCoopDungeonChamber(session, expectedVersion, now);
  if (!result.success || !result.session) return result;
  return { ...result, session: saveCoopDungeonSession(result.session, now) };
}

export async function applyCurrentCoopDungeonAction(
  sessionId: string,
  action: SynchronizedBattleAction,
  expectedVersion: number,
  now = Date.now(),
): Promise<CoopDungeonSessionResult> {
  const actor = requireCurrentActor(action.actorUsername);
  if (!actor.allowed) return { success: false, error: actor.error };

  if (shouldUseOnlineCoopDungeonClient()) {
    try {
      const payload = await postOnlineCoopDungeonAction(sessionId, action, expectedVersion);
      return {
        success: true,
        session: saveCoopDungeonSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to apply dungeon action.');
    }
  }

  const session = getStoredSession(sessionId, now);
  if (!session) return { success: false, error: 'Dungeon session was not found.' };
  const result = applyCoopDungeonAction(session, action, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: saveCoopDungeonSession(result.session, now) };
}

/** Sync local apply for snappy BattleModal UI; pair with background postOnlineCoopDungeonAction when online. */
export function applyLocalCurrentCoopDungeonAction(
  sessionId: string,
  action: SynchronizedBattleAction,
  expectedVersion: number,
  now = Date.now(),
): CoopDungeonSessionResult {
  const actor = requireCurrentActor(action.actorUsername);
  if (!actor.allowed) return { success: false, error: actor.error };
  const session = getStoredSession(sessionId, now);
  if (!session) return { success: false, error: 'Dungeon session was not found.' };
  const result = applyCoopDungeonAction(session, action, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: saveCoopDungeonSession(result.session, now) };
}

export async function abandonCurrentCoopDungeonSession(
  sessionId: string,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): Promise<CoopDungeonSessionResult> {
  const actor = requireCurrentActor(username);
  if (!actor.allowed) return { success: false, error: actor.error };

  if (shouldUseOnlineCoopDungeonClient()) {
    try {
      const payload = await updateOnlineCoopDungeonSession(sessionId, {
        action: 'abandon',
        expectedVersion,
      });
      return {
        success: true,
        session: saveCoopDungeonSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to abandon dungeon route.');
    }
  }

  const session = getStoredSession(sessionId, now);
  if (!session) return { success: false, error: 'Dungeon session was not found.' };
  const result = abandonCoopDungeonSession(session, username, expectedVersion, now);
  if (!result.success || !result.session) return result;
  return { ...result, session: saveCoopDungeonSession(result.session, now) };
}

export function dismissCompletedCoopDungeonSession(
  sessionId: string,
  username: string,
  now = Date.now(),
): CoopDungeonSessionResult {
  const actor = requireCurrentActor(username);
  if (!actor.allowed) return { success: false, error: actor.error };

  const session = getStoredSession(sessionId, now);
  if (!session) return { success: false, error: 'Dungeon session was not found.' };
  if (!getCoopDungeonMemberRole(session, username)) {
    return { success: false, session, error: 'Player is not part of this dungeon route.' };
  }
  if (session.phase !== 'complete' && session.phase !== 'abandoned') {
    return { success: false, session, error: 'Route is still in progress.' };
  }

  const remaining = getCoopDungeonSessions(now).filter(existing => existing.id !== sessionId);
  writeGameJson(COOP_DUNGEON_SESSIONS_KEY, remaining);
  return { success: true, session };
}
