import {
  DEFAULT_EQUIPPED_SPELL_IDS,
  MAX_FIELD_MINIONS,
  getFieldedMinions,
  type CharacterStats,
  type MinionStack,
  type User,
} from './auth';
import {
  applySynchronizedBattleAction,
  createPvpBattleState,
  type BattleChallenge,
  type BattleState,
  type BattleUserProfile,
  type SynchronizedBattleAction,
} from './battle';
import {
  getFormationIssue,
  makeDefaultFormation,
  mergeFormation,
} from './formation';

export type PvpDuelPhase = 'formation' | 'active' | 'completed' | 'cancelled' | 'expired';
export type PvpDuelSide = 'challenger' | 'defender';
export type PvpDuelResultReason = 'battle' | 'forfeit';

export interface PvpDuelPlayerSnapshot extends BattleUserProfile {
  knownSpellIds: string[];
  equippedSpellIds: string[];
  capturedAt: number;
}

export interface PvpDuelFormationState {
  username: string;
  placements: Record<string, { x: number; y: number }>;
  equippedSpellIds: string[];
  confirmedAt?: number;
}

export interface PvpDuelResult {
  winnerUsername: string;
  loserUsername: string;
  reason: PvpDuelResultReason;
  completedAt: number;
  finalBattleRevision: number;
  ratingApplied: boolean;
}

export interface PvpDuelSession {
  id: string;
  challengeId: string;
  schemaVersion: number;
  version: number;
  phase: PvpDuelPhase;
  challengerUsername: string;
  defenderUsername: string;
  acceptedAt: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  seed: string;
  challengerSnapshot: PvpDuelPlayerSnapshot;
  defenderSnapshot: PvpDuelPlayerSnapshot;
  challengerFormation: PvpDuelFormationState;
  defenderFormation: PvpDuelFormationState;
  combatSnapshot?: BattleState;
  result?: PvpDuelResult;
  cancelledBy?: string;
}

export interface PvpDuelSessionResult {
  success: boolean;
  session?: PvpDuelSession;
  duplicate?: boolean;
  error?: string;
}

export const PVP_DUEL_SCHEMA_VERSION = 1;
export const PVP_DUEL_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const PVP_DUEL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const VALID_DUEL_PHASES = new Set<PvpDuelPhase>(['formation', 'active', 'completed', 'cancelled', 'expired']);

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function cloneStats(stats: CharacterStats): CharacterStats {
  return { ...stats };
}

function cloneMinion(minion: MinionStack): MinionStack {
  return {
    ...minion,
    ...(minion.runStatBonus ? { runStatBonus: { ...minion.runStatBonus } } : {}),
  };
}

function normalizeSpellIds(spellIds: readonly string[] | null | undefined): string[] {
  const normalized = Array.from(new Set((spellIds || [])
    .filter(id => typeof id === 'string')
    .map(id => id.trim())
    .filter(Boolean)))
    .slice(0, 4);
  for (const spellId of DEFAULT_EQUIPPED_SPELL_IDS) {
    if (normalized.length >= 4) break;
    if (!normalized.includes(spellId)) normalized.push(spellId);
  }
  return normalized;
}

function normalizeKnownSpellIds(spellIds: readonly string[] | null | undefined): string[] {
  const normalized = Array.from(new Set((spellIds || [])
    .filter(id => typeof id === 'string')
    .map(id => id.trim())
    .filter(Boolean)))
    .slice(0, 40);
  return normalized.length > 0 ? normalized : [...DEFAULT_EQUIPPED_SPELL_IDS];
}

function capturePlayerSnapshot(user: User, now: number): PvpDuelPlayerSnapshot {
  const equippedSpellIds = normalizeSpellIds(user.equippedSpellIds);
  const knownSpellIds = Array.from(new Set([
    ...normalizeKnownSpellIds(user.knownSpellIds),
    ...equippedSpellIds,
  ])).slice(0, 40);
  return {
    username: user.username,
    stats: cloneStats(user.stats),
    selectedModel: user.selectedModel,
    x: user.x,
    y: user.y,
    minions: getFieldedMinions(user).slice(0, MAX_FIELD_MINIONS).map(cloneMinion),
    knownSpellIds,
    equippedSpellIds,
    capturedAt: now,
  };
}

function makeFormationState(snapshot: PvpDuelPlayerSnapshot): PvpDuelFormationState {
  return {
    username: snapshot.username,
    placements: makeDefaultFormation(snapshot.minions),
    equippedSpellIds: [...snapshot.equippedSpellIds],
  };
}

export function getPvpDuelSide(session: PvpDuelSession, username: string): PvpDuelSide | null {
  const normalized = normalizeUsername(username);
  if (normalizeUsername(session.challengerUsername) === normalized) return 'challenger';
  if (normalizeUsername(session.defenderUsername) === normalized) return 'defender';
  return null;
}

function getFormationForSide(session: PvpDuelSession, side: PvpDuelSide): PvpDuelFormationState {
  return side === 'challenger' ? session.challengerFormation : session.defenderFormation;
}

function getSnapshotForSide(session: PvpDuelSession, side: PvpDuelSide): PvpDuelPlayerSnapshot {
  return side === 'challenger' ? session.challengerSnapshot : session.defenderSnapshot;
}

function withSessionVersion(session: PvpDuelSession, updates: Partial<PvpDuelSession>, now: number): PvpDuelSession {
  return {
    ...session,
    ...updates,
    version: session.version + 1,
    updatedAt: now,
  };
}

export function normalizePvpDuelSessions(
  sessions: readonly PvpDuelSession[] | null | undefined,
  now = Date.now(),
): PvpDuelSession[] {
  const seenIds = new Set<string>();
  const normalized: PvpDuelSession[] = [];

  (sessions || []).forEach(session => {
    const id = typeof session?.id === 'string' ? session.id.trim().slice(0, 180) : '';
    const challengeId = typeof session?.challengeId === 'string' ? session.challengeId.trim().slice(0, 180) : '';
    const challengerUsername = typeof session?.challengerUsername === 'string' ? session.challengerUsername.trim() : '';
    const defenderUsername = typeof session?.defenderUsername === 'string' ? session.defenderUsername.trim() : '';
    if (
      !id
      || !challengeId
      || !challengerUsername
      || !defenderUsername
      || normalizeUsername(challengerUsername) === normalizeUsername(defenderUsername)
      || seenIds.has(id)
      || !session.challengerSnapshot
      || !session.defenderSnapshot
      || !session.challengerFormation
      || !session.defenderFormation
    ) return;

    const createdAt = Number.isFinite(session.createdAt) ? Number(session.createdAt) : now;
    const updatedAt = Number.isFinite(session.updatedAt) ? Number(session.updatedAt) : createdAt;
    const expiresAt = Number.isFinite(session.expiresAt)
      ? Math.max(createdAt, Number(session.expiresAt))
      : createdAt + PVP_DUEL_SESSION_TTL_MS;
    if (updatedAt < now - PVP_DUEL_RETENTION_MS) return;

    const rawPhase = VALID_DUEL_PHASES.has(session.phase) ? session.phase : 'formation';
    let phase = (rawPhase === 'formation' || rawPhase === 'active') && expiresAt <= now
      ? 'expired' as const
      : rawPhase;
    if (phase === 'active' && !session.combatSnapshot) phase = 'formation';
    if (phase === 'completed' && !session.result) phase = 'cancelled';

    seenIds.add(id);
    normalized.push({
      ...session,
      id,
      challengeId,
      schemaVersion: PVP_DUEL_SCHEMA_VERSION,
      version: Math.max(1, Math.floor(Number(session.version) || 1)),
      phase,
      challengerUsername,
      defenderUsername,
      acceptedAt: Number.isFinite(session.acceptedAt) ? Number(session.acceptedAt) : createdAt,
      createdAt,
      updatedAt,
      expiresAt,
      seed: typeof session.seed === 'string' && session.seed ? session.seed : `${challengeId}:${createdAt}`,
      ...(session.combatSnapshot ? {
        combatSnapshot: {
          ...session.combatSnapshot,
          mode: 'pvp',
          revision: Math.max(0, Math.floor(Number(session.combatSnapshot.revision) || 0)),
          processedActionIds: Array.from(new Set(session.combatSnapshot.processedActionIds || [])).slice(0, 240),
        },
      } : {}),
    });
  });

  return normalized.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 20);
}

export function createPvpDuelSession(
  challenge: Pick<BattleChallenge, 'id' | 'challengerUsername' | 'targetUsername' | 'readyAt' | 'status'>,
  challenger: User,
  defender: User,
  now = Date.now(),
): PvpDuelSessionResult {
  if (challenge.status !== 'ready') {
    return { success: false, error: 'Both players must accept the challenge first.' };
  }
  if (
    normalizeUsername(challenge.challengerUsername) !== normalizeUsername(challenger.username)
    || normalizeUsername(challenge.targetUsername) !== normalizeUsername(defender.username)
  ) {
    return { success: false, error: 'Challenge participants do not match the combat profiles.' };
  }

  const challengerSnapshot = capturePlayerSnapshot(challenger, now);
  const defenderSnapshot = capturePlayerSnapshot(defender, now);
  const acceptedAt = challenge.readyAt || now;
  const session: PvpDuelSession = {
    id: `pvp-duel-${challenge.id}`,
    challengeId: challenge.id,
    schemaVersion: PVP_DUEL_SCHEMA_VERSION,
    version: 1,
    phase: 'formation',
    challengerUsername: challenger.username,
    defenderUsername: defender.username,
    acceptedAt,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + PVP_DUEL_SESSION_TTL_MS,
    seed: `${challenge.id}:${acceptedAt}`,
    challengerSnapshot,
    defenderSnapshot,
    challengerFormation: makeFormationState(challengerSnapshot),
    defenderFormation: makeFormationState(defenderSnapshot),
  };
  return { success: true, session };
}

export function confirmPvpDuelFormation(
  session: PvpDuelSession,
  username: string,
  placements: Record<string, { x: number; y: number }>,
  equippedSpellIds: string[],
  expectedVersion: number,
  now = Date.now(),
): PvpDuelSessionResult {
  if (session.phase !== 'formation') return { success: false, session, error: 'Duel formation is closed.' };
  if (session.expiresAt <= now) {
    return { success: false, session: { ...session, phase: 'expired', updatedAt: now }, error: 'Duel session expired.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Duel session changed. Refresh before confirming.' };
  }

  const side = getPvpDuelSide(session, username);
  if (!side) return { success: false, session, error: 'Player is not part of this duel.' };
  const currentFormation = getFormationForSide(session, side);
  if (currentFormation.confirmedAt) {
    return { success: true, session, duplicate: true };
  }

  const snapshot = getSnapshotForSide(session, side);
  const mergedPlacements = mergeFormation(snapshot.minions, placements, MAX_FIELD_MINIONS);
  const formationIssue = getFormationIssue(mergedPlacements, snapshot.minions);
  if (formationIssue) return { success: false, session, error: formationIssue };
  const knownSpellIds = new Set(snapshot.knownSpellIds);
  const normalizedEquippedSpellIds = normalizeSpellIds(equippedSpellIds);
  if (normalizedEquippedSpellIds.some(spellId => !knownSpellIds.has(spellId))) {
    return { success: false, session, error: 'Duel loadout contains a spell outside the captured profile.' };
  }

  const confirmedFormation: PvpDuelFormationState = {
    username: snapshot.username,
    placements: mergedPlacements,
    equippedSpellIds: normalizedEquippedSpellIds,
    confirmedAt: now,
  };
  let nextSession = withSessionVersion(session, side === 'challenger'
    ? { challengerFormation: confirmedFormation }
    : { defenderFormation: confirmedFormation }, now);

  if (nextSession.challengerFormation.confirmedAt && nextSession.defenderFormation.confirmedAt) {
    const combatSnapshot = createPvpBattleState(
      nextSession.challengerSnapshot,
      nextSession.defenderSnapshot,
      {
        battleId: `battle-${nextSession.id}`,
        challengerFormation: nextSession.challengerFormation.placements,
        defenderFormation: nextSession.defenderFormation.placements,
        challengerStacks: nextSession.challengerSnapshot.minions,
        defenderStacks: nextSession.defenderSnapshot.minions,
        now,
      },
    );
    nextSession = { ...nextSession, phase: 'active', combatSnapshot };
  }

  return { success: true, session: nextSession };
}

function completeSessionFromBattle(
  session: PvpDuelSession,
  battle: BattleState,
  now: number,
): PvpDuelSessionResult {
  if (battle.status === 'active') return { success: true, session };
  if (battle.status === 'recruited') {
    return { success: false, session, error: 'Recruit outcomes are not valid in a duel.' };
  }
  const winnerUsername = battle.status === 'victory'
    ? session.challengerUsername
    : session.defenderUsername;
  const loserUsername = battle.status === 'victory'
    ? session.defenderUsername
    : session.challengerUsername;
  return {
    success: true,
    session: withSessionVersion(session, {
      phase: 'completed',
      combatSnapshot: battle,
      result: {
        winnerUsername,
        loserUsername,
        reason: 'battle',
        completedAt: now,
        finalBattleRevision: battle.revision || 0,
        ratingApplied: false,
      },
    }, now),
  };
}

export function applyPvpDuelAction(
  session: PvpDuelSession,
  action: SynchronizedBattleAction,
  expectedVersion: number,
  now = Date.now(),
): PvpDuelSessionResult {
  if (session.phase !== 'active' || !session.combatSnapshot) {
    return { success: false, session, error: 'Duel combat is not active.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Duel session changed. Refresh before acting.' };
  }
  const side = getPvpDuelSide(session, action.actorUsername);
  if (!side) return { success: false, session, error: 'Player is not part of this duel.' };
  if (action.type === 'cast-spell') {
    const formation = getFormationForSide(session, side);
    if (!action.spellId || !formation.equippedSpellIds.includes(action.spellId)) {
      return { success: false, session, error: 'That spell is not equipped for this duel.' };
    }
  }

  const actionResult = applySynchronizedBattleAction(session.combatSnapshot, action, now);
  if (!actionResult.success) return { success: false, session, error: actionResult.error };
  if (actionResult.duplicate) return { success: true, session, duplicate: true };

  if (actionResult.state.status !== 'active') {
    return completeSessionFromBattle(session, actionResult.state, now);
  }
  return {
    success: true,
    session: withSessionVersion(session, { combatSnapshot: actionResult.state }, now),
  };
}

export function forfeitPvpDuelSession(
  session: PvpDuelSession,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): PvpDuelSessionResult {
  if (session.phase === 'completed') return { success: true, session, duplicate: true };
  if (session.phase !== 'formation' && session.phase !== 'active') {
    return { success: false, session, error: 'Duel can no longer be forfeited.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Duel session changed. Refresh before forfeiting.' };
  }
  const side = getPvpDuelSide(session, username);
  if (!side) return { success: false, session, error: 'Player is not part of this duel.' };
  const winnerUsername = side === 'challenger' ? session.defenderUsername : session.challengerUsername;

  return {
    success: true,
    session: withSessionVersion(session, {
      phase: 'completed',
      result: {
        winnerUsername,
        loserUsername: username,
        reason: 'forfeit',
        completedAt: now,
        finalBattleRevision: session.combatSnapshot?.revision || 0,
        ratingApplied: false,
      },
    }, now),
  };
}

export function cancelPvpDuelSession(
  session: PvpDuelSession,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): PvpDuelSessionResult {
  if (session.phase === 'cancelled') return { success: true, session, duplicate: true };
  if (session.phase !== 'formation') {
    return { success: false, session, error: 'Active duels must be forfeited.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Duel session changed. Refresh before cancelling.' };
  }
  if (!getPvpDuelSide(session, username)) {
    return { success: false, session, error: 'Player is not part of this duel.' };
  }
  return {
    success: true,
    session: withSessionVersion(session, { phase: 'cancelled', cancelledBy: username }, now),
  };
}

export function markPvpDuelRatingApplied(
  session: PvpDuelSession,
  now = Date.now(),
): PvpDuelSessionResult {
  if (session.phase !== 'completed' || !session.result) {
    return { success: false, session, error: 'Duel result is not complete.' };
  }
  if (session.result.ratingApplied) return { success: true, session, duplicate: true };
  return {
    success: true,
    session: withSessionVersion(session, {
      result: { ...session.result, ratingApplied: true },
    }, now),
  };
}
