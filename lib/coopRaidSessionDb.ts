import { isSupabaseAdminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  normalizeCoopRaidSessions,
  type CoopRaidClaimReceipt,
  type CoopRaidFormationState,
  type CoopRaidPhase,
  type CoopRaidPlayerSnapshot,
  type CoopRaidResult,
  type CoopRaidSession,
} from '@/lib/coopRaidSessions';
import type { BattleState, WorldEnemy } from '@/lib/battle';

export type CoopRaidSessionDbPhase = CoopRaidPhase;

export interface CoopRaidSessionDbRow {
  id: string;
  party_id: string | null;
  host_id: string;
  ally_id: string;
  boss_id: string;
  phase: CoopRaidSessionDbPhase;
  version: number;
  boss_snapshot: WorldEnemy | Record<string, unknown>;
  host_snapshot: CoopRaidPlayerSnapshot | Record<string, unknown>;
  ally_snapshot: CoopRaidPlayerSnapshot | Record<string, unknown>;
  host_formation: CoopRaidFormationState | Record<string, unknown>;
  ally_formation: CoopRaidFormationState | Record<string, unknown>;
  combat_snapshot: BattleState | CoopRaidSessionMetaEnvelope | Record<string, unknown> | null;
  result: (CoopRaidResult & CoopRaidResultMeta) | Record<string, unknown> | null;
  turn_deadline_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

interface CoopRaidResultMeta {
  seed?: string;
  schemaVersion?: number;
  partyId?: string;
  partyUpdatedAt?: number;
  abandonedBy?: string;
}

interface CoopRaidSessionMetaEnvelope {
  __coopRaidMeta: true;
  seed: string;
  schemaVersion: number;
  partyId: string;
  partyUpdatedAt: number;
  abandonedBy?: string;
}

export function shouldUseOnlineCoopRaidSessions(): boolean {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

export function getCoopRaidSessionAdminClient() {
  return createAdminClient();
}

function toTimestamp(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function asSnapshot(value: unknown, username: string, now: number): CoopRaidPlayerSnapshot {
  const record = (value && typeof value === 'object' ? value : {}) as Partial<CoopRaidPlayerSnapshot>;
  return {
    username: typeof record.username === 'string' && record.username.trim() ? record.username : username,
    stats: (record.stats || { level: 1 }) as CoopRaidPlayerSnapshot['stats'],
    selectedModel: Number(record.selectedModel) || 3,
    x: Number(record.x) || 0,
    y: Number(record.y) || 0,
    minions: Array.isArray(record.minions) ? record.minions : [],
    knownSpellIds: Array.isArray(record.knownSpellIds) ? record.knownSpellIds.map(String) : [],
    equippedSpellIds: Array.isArray(record.equippedSpellIds) ? record.equippedSpellIds.map(String) : [],
    capturedAt: Number.isFinite(record.capturedAt) ? Number(record.capturedAt) : now,
  };
}

function asFormation(value: unknown, username: string): CoopRaidFormationState {
  const record = (value && typeof value === 'object' ? value : {}) as Partial<CoopRaidFormationState>;
  return {
    username: typeof record.username === 'string' && record.username.trim() ? record.username : username,
    placements: record.placements && typeof record.placements === 'object'
      ? record.placements as Record<string, { x: number; y: number }>
      : {},
    equippedSpellIds: Array.isArray(record.equippedSpellIds) ? record.equippedSpellIds.map(String) : [],
    ...(Number.isFinite(record.confirmedAt) ? { confirmedAt: Number(record.confirmedAt) } : {}),
  };
}

function asBossSnapshot(value: unknown, bossId: string): WorldEnemy {
  const record = (value && typeof value === 'object' ? value : {}) as Partial<WorldEnemy>;
  return {
    ...(record as WorldEnemy),
    id: typeof record.id === 'string' && record.id.trim() ? record.id : bossId,
    name: typeof record.name === 'string' && record.name.trim() ? record.name : 'Co-op Raid Boss',
    minions: Array.isArray(record.minions) ? record.minions : [],
    spawnKind: 'coop-boss',
  };
}

function isMetaEnvelope(value: unknown): value is CoopRaidSessionMetaEnvelope {
  return Boolean(value && typeof value === 'object' && (value as CoopRaidSessionMetaEnvelope).__coopRaidMeta === true);
}

function packCombatSnapshot(session: CoopRaidSession): BattleState | CoopRaidSessionMetaEnvelope {
  if (session.combatSnapshot) return session.combatSnapshot;
  return {
    __coopRaidMeta: true,
    seed: session.seed,
    schemaVersion: session.schemaVersion,
    partyId: session.partyId,
    partyUpdatedAt: session.partyUpdatedAt,
    ...(session.abandonedBy ? { abandonedBy: session.abandonedBy } : {}),
  };
}

function packResult(session: CoopRaidSession): CoopRaidSessionDbRow['result'] {
  const meta: CoopRaidResultMeta = {
    seed: session.seed,
    schemaVersion: session.schemaVersion,
    partyId: session.partyId,
    partyUpdatedAt: session.partyUpdatedAt,
    ...(session.abandonedBy ? { abandonedBy: session.abandonedBy } : {}),
  };
  if (session.result) {
    return { ...session.result, ...meta };
  }
  return meta as CoopRaidSessionDbRow['result'];
}

function asClaimReceipts(value: unknown): CoopRaidClaimReceipt[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((receipt): receipt is CoopRaidClaimReceipt => Boolean(
      receipt
      && typeof receipt === 'object'
      && typeof (receipt as CoopRaidClaimReceipt).username === 'string',
    ))
    .map(receipt => ({
      username: receipt.username,
      claimedAt: Number(receipt.claimedAt) || 0,
      reward: receipt.reward || { gold: 0, exp: 0, rareGems: 0, equipmentRarity: 'epic' as const },
      ...(receipt.equipmentName ? { equipmentName: String(receipt.equipmentName) } : {}),
    }));
}

export function coopRaidSessionToDbPayload(
  session: CoopRaidSession,
  hostId: string,
  allyId: string,
): Omit<CoopRaidSessionDbRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
} {
  return {
    id: session.id,
    party_id: null,
    host_id: hostId,
    ally_id: allyId,
    boss_id: session.bossId,
    phase: session.phase,
    version: session.version,
    boss_snapshot: session.bossSnapshot,
    host_snapshot: session.hostSnapshot,
    ally_snapshot: session.allySnapshot,
    host_formation: session.hostFormation,
    ally_formation: session.allyFormation,
    combat_snapshot: packCombatSnapshot(session),
    result: packResult(session),
    turn_deadline_at: null,
    expires_at: new Date(session.expiresAt).toISOString(),
  };
}

export function coopRaidSessionFromDbRow(
  row: CoopRaidSessionDbRow,
  hostUsername: string,
  allyUsername: string,
  now = Date.now(),
): CoopRaidSession {
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
    : metaFromCombat?.seed || `${row.boss_id}:${row.id}:${createdAt}`;
  const schemaVersion = Number(resultRecord.schemaVersion || metaFromCombat?.schemaVersion) || 1;
  const partyId = typeof resultRecord.partyId === 'string' && resultRecord.partyId
    ? resultRecord.partyId
    : metaFromCombat?.partyId || `${hostUsername}|${allyUsername}`.toLowerCase();
  const partyUpdatedAt = Number(resultRecord.partyUpdatedAt || metaFromCombat?.partyUpdatedAt) || createdAt;
  const abandonedBy = typeof resultRecord.abandonedBy === 'string'
    ? resultRecord.abandonedBy
    : metaFromCombat?.abandonedBy;

  const hasResult = typeof resultRecord.outcome === 'string'
    && ['victory', 'defeat', 'abandoned'].includes(String(resultRecord.outcome));

  const session: CoopRaidSession = {
    id: row.id,
    schemaVersion,
    version: Math.max(1, Math.floor(Number(row.version) || 1)),
    phase: row.phase,
    partyId,
    partyUpdatedAt,
    bossId: row.boss_id,
    bossSnapshot: asBossSnapshot(row.boss_snapshot, row.boss_id),
    hostUsername,
    allyUsername,
    createdAt,
    updatedAt,
    expiresAt,
    seed,
    hostSnapshot: asSnapshot(row.host_snapshot, hostUsername, createdAt),
    allySnapshot: asSnapshot(row.ally_snapshot, allyUsername, createdAt),
    hostFormation: asFormation(row.host_formation, hostUsername),
    allyFormation: asFormation(row.ally_formation, allyUsername),
    ...(combatSnapshot ? { combatSnapshot } : {}),
    ...(hasResult ? {
      result: {
        outcome: resultRecord.outcome as CoopRaidResult['outcome'],
        completedAt: Number(resultRecord.completedAt) || updatedAt,
        finalBattleRevision: Math.max(0, Math.floor(Number(resultRecord.finalBattleRevision) || 0)),
        claimReceipts: asClaimReceipts(resultRecord.claimReceipts),
      },
    } : {}),
    ...(abandonedBy ? { abandonedBy } : {}),
  };

  return normalizeCoopRaidSessions([session], now)[0] || session;
}
