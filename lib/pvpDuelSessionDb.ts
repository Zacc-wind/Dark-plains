import { isSupabaseAdminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  normalizePvpDuelSessions,
  type PvpDuelFormationState,
  type PvpDuelPhase,
  type PvpDuelPlayerSnapshot,
  type PvpDuelResult,
  type PvpDuelSession,
} from '@/lib/pvpDuelSessions';
import type { BattleState } from '@/lib/battle';

/** DB phases from migration 007 (cancelled maps to abandoned). */
export type PvpDuelSessionDbPhase =
  | 'formation'
  | 'active'
  | 'completed'
  | 'abandoned'
  | 'expired';

export interface PvpDuelSessionDbRow {
  id: string;
  challenge_id: string | null;
  challenger_id: string;
  target_id: string;
  phase: PvpDuelSessionDbPhase;
  version: number;
  challenger_snapshot: PvpDuelPlayerSnapshot | Record<string, unknown>;
  target_snapshot: PvpDuelPlayerSnapshot | Record<string, unknown>;
  challenger_formation: PvpDuelFormationState | Record<string, unknown>;
  target_formation: PvpDuelFormationState | Record<string, unknown>;
  combat_snapshot: BattleState | DuelSessionMetaEnvelope | Record<string, unknown> | null;
  result: (PvpDuelResult & { seed?: string; schemaVersion?: number; acceptedAt?: number; cancelledBy?: string }) | Record<string, unknown> | null;
  turn_deadline_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

interface DuelSessionMetaEnvelope {
  __pvpDuelMeta: true;
  seed: string;
  schemaVersion: number;
  acceptedAt: number;
  cancelledBy?: string;
}

export function shouldUseOnlinePvpDuelSessions(): boolean {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

export function getPvpDuelSessionAdminClient() {
  return createAdminClient();
}

export function duelPhaseToDb(phase: PvpDuelPhase): PvpDuelSessionDbPhase {
  if (phase === 'cancelled') return 'abandoned';
  return phase;
}

export function duelPhaseFromDb(phase: PvpDuelSessionDbPhase): PvpDuelPhase {
  if (phase === 'abandoned') return 'cancelled';
  return phase;
}

function toTimestamp(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function asSnapshot(value: unknown, username: string, now: number): PvpDuelPlayerSnapshot {
  const record = (value && typeof value === 'object' ? value : {}) as Partial<PvpDuelPlayerSnapshot>;
  return {
    username: typeof record.username === 'string' && record.username.trim() ? record.username : username,
    stats: (record.stats || { level: 1 }) as PvpDuelPlayerSnapshot['stats'],
    selectedModel: Number(record.selectedModel) || 3,
    x: Number(record.x) || 0,
    y: Number(record.y) || 0,
    minions: Array.isArray(record.minions) ? record.minions : [],
    knownSpellIds: Array.isArray(record.knownSpellIds) ? record.knownSpellIds.map(String) : [],
    equippedSpellIds: Array.isArray(record.equippedSpellIds) ? record.equippedSpellIds.map(String) : [],
    capturedAt: Number.isFinite(record.capturedAt) ? Number(record.capturedAt) : now,
  };
}

function asFormation(value: unknown, username: string): PvpDuelFormationState {
  const record = (value && typeof value === 'object' ? value : {}) as Partial<PvpDuelFormationState>;
  return {
    username: typeof record.username === 'string' && record.username.trim() ? record.username : username,
    placements: record.placements && typeof record.placements === 'object'
      ? record.placements as Record<string, { x: number; y: number }>
      : {},
    equippedSpellIds: Array.isArray(record.equippedSpellIds) ? record.equippedSpellIds.map(String) : [],
    ...(Number.isFinite(record.confirmedAt) ? { confirmedAt: Number(record.confirmedAt) } : {}),
  };
}

function isMetaEnvelope(value: unknown): value is DuelSessionMetaEnvelope {
  return Boolean(value && typeof value === 'object' && (value as DuelSessionMetaEnvelope).__pvpDuelMeta === true);
}

function packCombatSnapshot(session: PvpDuelSession): BattleState | DuelSessionMetaEnvelope {
  if (session.combatSnapshot) return session.combatSnapshot;
  return {
    __pvpDuelMeta: true,
    seed: session.seed,
    schemaVersion: session.schemaVersion,
    acceptedAt: session.acceptedAt,
    ...(session.cancelledBy ? { cancelledBy: session.cancelledBy } : {}),
  };
}

function packResult(session: PvpDuelSession): PvpDuelSessionDbRow['result'] {
  const meta = {
    seed: session.seed,
    schemaVersion: session.schemaVersion,
    acceptedAt: session.acceptedAt,
    ...(session.cancelledBy ? { cancelledBy: session.cancelledBy } : {}),
  };
  if (session.result) {
    return { ...session.result, ...meta };
  }
  return meta;
}

export function pvpDuelSessionToDbPayload(
  session: PvpDuelSession,
  challengerId: string,
  targetId: string,
): Omit<PvpDuelSessionDbRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
} {
  return {
    id: session.id,
    challenge_id: session.challengeId,
    challenger_id: challengerId,
    target_id: targetId,
    phase: duelPhaseToDb(session.phase),
    version: session.version,
    challenger_snapshot: session.challengerSnapshot,
    target_snapshot: session.defenderSnapshot,
    challenger_formation: session.challengerFormation,
    target_formation: session.defenderFormation,
    combat_snapshot: packCombatSnapshot(session),
    result: packResult(session),
    turn_deadline_at: null,
    expires_at: new Date(session.expiresAt).toISOString(),
  };
}

export function pvpDuelSessionFromDbRow(
  row: PvpDuelSessionDbRow,
  challengerUsername: string,
  defenderUsername: string,
  now = Date.now(),
): PvpDuelSession {
  const createdAt = toTimestamp(row.created_at, now);
  const updatedAt = toTimestamp(row.updated_at, createdAt);
  const expiresAt = toTimestamp(row.expires_at, createdAt);
  const resultRecord = (row.result && typeof row.result === 'object' ? row.result : {}) as Record<string, unknown>;
  const combatRaw = row.combat_snapshot;
  const metaFromCombat = isMetaEnvelope(combatRaw) ? combatRaw : null;
  const combatSnapshot = combatRaw && !isMetaEnvelope(combatRaw)
    ? combatRaw as BattleState
    : undefined;

  const seed = typeof resultRecord.seed === 'string' && resultRecord.seed
    ? resultRecord.seed
    : metaFromCombat?.seed || `${row.challenge_id || row.id}:${createdAt}`;
  const schemaVersion = Number(resultRecord.schemaVersion || metaFromCombat?.schemaVersion) || 1;
  const acceptedAt = Number(resultRecord.acceptedAt || metaFromCombat?.acceptedAt) || createdAt;
  const cancelledBy = typeof resultRecord.cancelledBy === 'string'
    ? resultRecord.cancelledBy
    : metaFromCombat?.cancelledBy;

  const hasResult = typeof resultRecord.winnerUsername === 'string'
    && typeof resultRecord.loserUsername === 'string';

  const session: PvpDuelSession = {
    id: row.id,
    challengeId: row.challenge_id || row.id.replace(/^pvp-duel-/, ''),
    schemaVersion,
    version: Math.max(1, Math.floor(Number(row.version) || 1)),
    phase: duelPhaseFromDb(row.phase),
    challengerUsername,
    defenderUsername,
    acceptedAt,
    createdAt,
    updatedAt,
    expiresAt,
    seed,
    challengerSnapshot: asSnapshot(row.challenger_snapshot, challengerUsername, createdAt),
    defenderSnapshot: asSnapshot(row.target_snapshot, defenderUsername, createdAt),
    challengerFormation: asFormation(row.challenger_formation, challengerUsername),
    defenderFormation: asFormation(row.target_formation, defenderUsername),
    ...(combatSnapshot ? { combatSnapshot } : {}),
    ...(hasResult ? {
      result: {
        winnerUsername: String(resultRecord.winnerUsername),
        loserUsername: String(resultRecord.loserUsername),
        reason: resultRecord.reason === 'forfeit' ? 'forfeit' as const : 'battle' as const,
        completedAt: Number(resultRecord.completedAt) || updatedAt,
        finalBattleRevision: Math.max(0, Math.floor(Number(resultRecord.finalBattleRevision) || 0)),
        ratingApplied: Boolean(resultRecord.ratingApplied),
      },
    } : {}),
    ...(cancelledBy ? { cancelledBy } : {}),
  };

  return normalizePvpDuelSessions([session], now)[0] || session;
}
