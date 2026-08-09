'use client';

import {
  getCurrentUser,
  getPartyMembers,
  getSocialState,
  recordCoopRaidOutcome,
} from './auth';
import {
  getActiveCoopBosses,
  type SynchronizedBattleAction,
} from './battle';
import {
  abandonCoopRaidSession,
  applyCoopRaidAction,
  confirmCoopRaidFormation,
  createCoopRaidSession,
  getCoopRaidMemberRole,
  getCoopRaidReward,
  markCoopRaidClaimed,
  normalizeCoopRaidSessions,
  type CoopRaidSession,
  type CoopRaidSessionResult,
} from './coopRaidSessions';
import {
  createOnlineCoopRaidSession,
  fetchOnlineCoopRaidSessions,
  shouldUseOnlineCoopRaidClient,
  updateOnlineCoopRaidSession,
} from './coopRaidOnlineClient';
import { readGameJson, writeGameJson } from './gameStore';

const COOP_RAID_SESSIONS_KEY = 'pirate_game_coop_raid_sessions';
export const COOP_RAID_SESSION_UPDATED_EVENT = 'pirate-game:coop-raid-session-updated';

function emitSessionUpdated(session: CoopRaidSession): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(COOP_RAID_SESSION_UPDATED_EVENT, {
    detail: { sessionId: session.id, version: session.version },
  }));
}

function onlineError(error: unknown, fallback: string): CoopRaidSessionResult {
  const conflict = error as Error & { session?: CoopRaidSession; conflict?: boolean };
  if (conflict?.conflict && conflict.session) {
    saveCoopRaidSession(conflict.session);
    return { success: false, session: conflict.session, error: conflict.message || fallback };
  }
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

export function getCoopRaidSessions(now = Date.now()): CoopRaidSession[] {
  return normalizeCoopRaidSessions(
    readGameJson<CoopRaidSession[]>(COOP_RAID_SESSIONS_KEY, []),
    now,
  );
}

export function saveCoopRaidSession(session: CoopRaidSession, now = Date.now()): CoopRaidSession {
  const sessions = normalizeCoopRaidSessions([
    session,
    ...getCoopRaidSessions(now).filter(existing => existing.id !== session.id),
  ], now);
  writeGameJson(COOP_RAID_SESSIONS_KEY, sessions);
  const saved = sessions.find(existing => existing.id === session.id) || session;
  emitSessionUpdated(saved);
  return saved;
}

export function getCurrentCoopRaidSession(
  username: string,
  now = Date.now(),
): CoopRaidSession | undefined {
  const sessions = getCoopRaidSessions(now).filter(session => getCoopRaidMemberRole(session, username));
  return sessions.find(session => session.phase === 'active')
    || sessions.find(session => session.phase === 'formation')
    || sessions.find(session => (
      session.phase === 'completed'
      && !session.result?.claimReceipts.some(receipt => receipt.username.toLowerCase() === username.toLowerCase())
    ));
}

export async function syncOnlineCoopRaidSessions(now = Date.now()): Promise<void> {
  if (!shouldUseOnlineCoopRaidClient()) return;
  try {
    const sessions = await fetchOnlineCoopRaidSessions();
    sessions.forEach(session => {
      saveCoopRaidSession(session, now);
    });
  } catch {
    // Keep local cache if sync fails.
  }
}

export async function ensureCurrentCoopRaidSession(
  bossId: string,
  now = Date.now(),
): Promise<CoopRaidSessionResult> {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const party = getSocialState(current).party;
  if (!party) return { success: false, error: 'Create a two-commander party first.' };

  const existing = getCoopRaidSessions(now).find(session => (
    session.bossId === bossId
    && getCoopRaidMemberRole(session, current.username)
    && session.phase !== 'abandoned'
    && session.phase !== 'expired'
  ));
  if (existing) {
    const currentClaimed = Boolean(existing.result?.claimReceipts.some(receipt => (
      receipt.username.toLowerCase() === current.username.toLowerCase()
    )));
    const allReportsClosed = Boolean(
      existing.result
      && existing.result.claimReceipts.length >= 2
    );
    const retryable = existing.phase === 'completed'
      && existing.result?.outcome !== 'victory'
      && allReportsClosed;

    if (existing.result?.outcome === 'victory' && currentClaimed) {
      return { success: false, session: existing, error: 'You already cleared and claimed this incursion.' };
    }
    if (!retryable) {
      emitSessionUpdated(existing);
      return { success: true, session: existing, duplicate: true };
    }
  }
  if (party.leaderUsername.toLowerCase() !== current.username.toLowerCase()) {
    return { success: false, error: 'Only the party leader can prepare a raid.' };
  }

  const members = getPartyMembers(current);
  if (members.length !== 2) {
    return { success: false, error: 'The first co-op raid requires exactly two accepted party members.' };
  }
  const host = members.find(member => member.username.toLowerCase() === party.leaderUsername.toLowerCase());
  const ally = members.find(member => member.username.toLowerCase() !== party.leaderUsername.toLowerCase());
  if (!host || !ally) return { success: false, error: 'Both party profiles are required to prepare the raid.' };

  if (shouldUseOnlineCoopRaidClient()) {
    try {
      const payload = await createOnlineCoopRaidSession(bossId, ally.username);
      return {
        success: true,
        session: saveCoopRaidSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to create online raid session.');
    }
  }

  const boss = getActiveCoopBosses(host, now).find(candidate => candidate.id === bossId);
  if (!boss) return { success: false, error: 'That co-op incursion is no longer active.' };
  const created = createCoopRaidSession(party, host, ally, boss, now);
  if (!created.success || !created.session) return created;
  return { ...created, session: saveCoopRaidSession(created.session, now) };
}

function getStoredSession(sessionId: string, now: number): CoopRaidSession | undefined {
  return getCoopRaidSessions(now).find(session => session.id === sessionId);
}

function requireCurrentActor(username: string): { allowed: true } | { allowed: false; error: string } {
  const current = getCurrentUser();
  if (!current) return { allowed: false, error: 'Login required.' };
  if (current.username.toLowerCase() !== username.toLowerCase()) {
    return { allowed: false, error: 'Raid commands must come from the current account.' };
  }
  return { allowed: true };
}

export async function confirmCurrentCoopRaidFormation(
  sessionId: string,
  username: string,
  placements: Record<string, { x: number; y: number }>,
  equippedSpellIds: string[],
  expectedVersion: number,
  now = Date.now(),
): Promise<CoopRaidSessionResult> {
  const actor = requireCurrentActor(username);
  if (!actor.allowed) return { success: false, error: actor.error };

  if (shouldUseOnlineCoopRaidClient()) {
    try {
      const payload = await updateOnlineCoopRaidSession(sessionId, {
        action: 'confirm_formation',
        expectedVersion,
        placements,
        equippedSpellIds,
      });
      return {
        success: true,
        session: saveCoopRaidSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to confirm raid formation.');
    }
  }

  const session = getStoredSession(sessionId, now);
  if (!session) return { success: false, error: 'Raid session was not found.' };
  const result = confirmCoopRaidFormation(
    session,
    username,
    placements,
    equippedSpellIds,
    expectedVersion,
    now,
  );
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: saveCoopRaidSession(result.session, now) };
}

export function applyCurrentCoopRaidAction(
  sessionId: string,
  action: SynchronizedBattleAction,
  expectedVersion: number,
  now = Date.now(),
): CoopRaidSessionResult {
  // Combat action streaming stays local for this slice.
  const actor = requireCurrentActor(action.actorUsername);
  if (!actor.allowed) return { success: false, error: actor.error };
  const session = getStoredSession(sessionId, now);
  if (!session) return { success: false, error: 'Raid session was not found.' };
  const result = applyCoopRaidAction(session, action, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: saveCoopRaidSession(result.session, now) };
}

export async function abandonCurrentCoopRaidSession(
  sessionId: string,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): Promise<CoopRaidSessionResult> {
  const actor = requireCurrentActor(username);
  if (!actor.allowed) return { success: false, error: actor.error };

  if (shouldUseOnlineCoopRaidClient()) {
    try {
      const payload = await updateOnlineCoopRaidSession(sessionId, {
        action: 'abandon',
        expectedVersion,
      });
      return {
        success: true,
        session: saveCoopRaidSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      return onlineError(error, 'Failed to abandon raid.');
    }
  }

  const session = getStoredSession(sessionId, now);
  if (!session) return { success: false, error: 'Raid session was not found.' };
  const result = abandonCoopRaidSession(session, username, expectedVersion, now);
  if (!result.success || !result.session || result.duplicate) return result;
  return { ...result, session: saveCoopRaidSession(result.session, now) };
}

export async function settleCurrentCoopRaidSession(
  sessionId: string,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): Promise<CoopRaidSessionResult> {
  const actor = requireCurrentActor(username);
  if (!actor.allowed) return { success: false, error: actor.error };
  const session = getStoredSession(sessionId, now);
  if (!session) return { success: false, error: 'Raid session was not found.' };
  if (session.phase !== 'completed' || !session.result) {
    return { success: false, session, error: 'Raid result is not ready.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Raid session changed. Refresh before claiming.' };
  }

  let equipmentName: string | undefined;
  if (session.result.outcome === 'victory') {
    const reward = getCoopRaidReward(session, username);
    const grant = recordCoopRaidOutcome(
      username,
      session.id,
      session.bossSnapshot.name,
      reward,
      now,
    );
    if (!grant.success) return { success: false, session, error: grant.error || 'Could not grant raid rewards.' };
    equipmentName = grant.equipmentName;
  }

  if (shouldUseOnlineCoopRaidClient()) {
    try {
      const payload = await updateOnlineCoopRaidSession(sessionId, {
        action: 'settle',
        expectedVersion,
        ...(equipmentName ? { equipmentName } : {}),
      });
      return {
        success: true,
        session: saveCoopRaidSession(payload.session, now),
        duplicate: payload.duplicate,
      };
    } catch (error) {
      const marked = markCoopRaidClaimed(session, username, expectedVersion, equipmentName, now);
      if (marked.success && marked.session) {
        return { ...marked, session: saveCoopRaidSession(marked.session, now) };
      }
      return onlineError(error, 'Failed to settle online raid.');
    }
  }

  const marked = markCoopRaidClaimed(session, username, expectedVersion, equipmentName, now);
  if (!marked.success || !marked.session || marked.duplicate) return marked;
  return { ...marked, session: saveCoopRaidSession(marked.session, now) };
}
