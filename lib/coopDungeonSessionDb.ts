import { isSupabaseAdminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  normalizeCoopDungeonSessions,
  type CoopDungeonChamber,
  type CoopDungeonPhase,
  type CoopDungeonPlayerSnapshot,
  type CoopDungeonSession,
} from '@/lib/coopDungeonSessions';
import type { BattleState, WorldEnemy } from '@/lib/battle';
import type { WorldDungeon } from '@/lib/worldEvents';

export type CoopDungeonSessionDbPhase = CoopDungeonPhase;

export interface CoopDungeonSessionDbRow {
  id: string;
  party_id: string | null;
  host_id: string;
  ally_id: string;
  dungeon_id: string;
  seed: string;
  phase: CoopDungeonSessionDbPhase;
  version: number;
  chambers: CoopDungeonChamber[] | Record<string, unknown>[];
  current_chamber_index: number;
  combat_snapshot: BattleState | Record<string, unknown> | null;
  result: CoopDungeonResultMeta | Record<string, unknown> | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

interface CoopDungeonResultMeta {
  __coopDungeonMeta?: true;
  schemaVersion?: number;
  partyId?: string;
  partyUpdatedAt?: number;
  abandonedBy?: string;
  dungeonSnapshot?: WorldDungeon | Record<string, unknown>;
  hostSnapshot?: CoopDungeonPlayerSnapshot | Record<string, unknown>;
  allySnapshot?: CoopDungeonPlayerSnapshot | Record<string, unknown>;
  chamberEnemy?: WorldEnemy | Record<string, unknown>;
}

export function shouldUseOnlineCoopDungeonSessions(): boolean {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

export function getCoopDungeonSessionAdminClient() {
  return createAdminClient();
}

function toTimestamp(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function asPlayerSnapshot(value: unknown, username: string, now: number): CoopDungeonPlayerSnapshot {
  const record = (value && typeof value === 'object' ? value : {}) as Partial<CoopDungeonPlayerSnapshot>;
  return {
    username: typeof record.username === 'string' && record.username.trim() ? record.username : username,
    stats: (record.stats || { level: 1 }) as CoopDungeonPlayerSnapshot['stats'],
    selectedModel: Number(record.selectedModel) || 3,
    x: Number(record.x) || 0,
    y: Number(record.y) || 0,
    minions: Array.isArray(record.minions) ? record.minions : [],
    capturedAt: Number.isFinite(record.capturedAt) ? Number(record.capturedAt) : now,
  };
}

function asDungeonSnapshot(value: unknown, dungeonId: string): WorldDungeon {
  const record = (value && typeof value === 'object' ? value : {}) as Partial<WorldDungeon>;
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : dungeonId,
    templateId: typeof record.templateId === 'string' ? record.templateId : dungeonId,
    name: typeof record.name === 'string' && record.name.trim() ? record.name : 'Duo Dungeon',
    bossId: typeof record.bossId === 'string' ? record.bossId : 'unknown-boss',
    bossName: typeof record.bossName === 'string' ? record.bossName : 'Dungeon Boss',
    bossSubtitle: typeof record.bossSubtitle === 'string' ? record.bossSubtitle : '',
    bossStory: typeof record.bossStory === 'string' ? record.bossStory : '',
    bossIntro: typeof record.bossIntro === 'string' ? record.bossIntro : '',
    bossArtworkPath: typeof record.bossArtworkPath === 'string' ? record.bossArtworkPath : '',
    bossModelNumber: (Number(record.bossModelNumber) || 5) as WorldDungeon['bossModelNumber'],
    bossPersonality: (record.bossPersonality || 'balanced') as WorldDungeon['bossPersonality'],
    bossMinionTemplates: Array.isArray(record.bossMinionTemplates)
      ? record.bossMinionTemplates.map(String)
      : [],
    x: Number(record.x) || 0,
    y: Number(record.y) || 0,
    level: Math.max(1, Number(record.level) || 1),
    tier: ([1, 2, 3].includes(Number(record.tier)) ? Number(record.tier) : 1) as WorldDungeon['tier'],
    requiredPlayerLevel: Math.max(1, Number(record.requiredPlayerLevel) || 1),
    expiresAt: Number.isFinite(record.expiresAt) ? Number(record.expiresAt) : Date.now() + 3_600_000,
    description: typeof record.description === 'string' ? record.description : '',
  };
}

function asChambers(value: unknown, sessionId: string): CoopDungeonChamber[] {
  if (!Array.isArray(value)) return [];
  return value.map((chamber, index) => {
    const record = (chamber && typeof chamber === 'object' ? chamber : {}) as Partial<CoopDungeonChamber>;
    return {
      id: typeof record.id === 'string' && record.id.trim()
        ? record.id.trim()
        : `${sessionId}:chamber-${index}`,
      label: typeof record.label === 'string' && record.label.trim()
        ? record.label.trim()
        : `Chamber ${index + 1}`,
      cleared: Boolean(record.cleared),
    };
  });
}

function asChamberEnemy(value: unknown): WorldEnemy | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Partial<WorldEnemy>;
  if (typeof record.id !== 'string' || !record.id.trim()) return undefined;
  return {
    ...(record as WorldEnemy),
    id: record.id,
    name: typeof record.name === 'string' && record.name.trim() ? record.name : 'Chamber Enemy',
    minions: Array.isArray(record.minions) ? record.minions : [],
    spawnKind: 'coop-boss',
  };
}

function packResult(session: CoopDungeonSession): CoopDungeonSessionDbRow['result'] {
  return {
    __coopDungeonMeta: true,
    schemaVersion: session.schemaVersion,
    partyId: session.partyId,
    partyUpdatedAt: session.partyUpdatedAt,
    dungeonSnapshot: session.dungeonSnapshot,
    hostSnapshot: session.hostSnapshot,
    allySnapshot: session.allySnapshot,
    ...(session.chamberEnemy ? { chamberEnemy: session.chamberEnemy } : {}),
    ...(session.abandonedBy ? { abandonedBy: session.abandonedBy } : {}),
  };
}

export function coopDungeonSessionToDbPayload(
  session: CoopDungeonSession,
  hostId: string,
  allyId: string,
): Omit<CoopDungeonSessionDbRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
} {
  return {
    id: session.id,
    party_id: null,
    host_id: hostId,
    ally_id: allyId,
    dungeon_id: session.dungeonId,
    seed: session.seed,
    phase: session.phase,
    version: session.version,
    chambers: session.chambers,
    current_chamber_index: session.currentChamberIndex,
    combat_snapshot: session.combatSnapshot || null,
    result: packResult(session),
    expires_at: new Date(session.expiresAt).toISOString(),
  };
}

export function coopDungeonSessionFromDbRow(
  row: CoopDungeonSessionDbRow,
  hostUsername: string,
  allyUsername: string,
  now = Date.now(),
): CoopDungeonSession {
  const createdAt = toTimestamp(row.created_at, now);
  const updatedAt = toTimestamp(row.updated_at, createdAt);
  const expiresAt = toTimestamp(row.expires_at, createdAt);
  const resultRecord = (row.result && typeof row.result === 'object' ? row.result : {}) as CoopDungeonResultMeta;
  const combatRaw = row.combat_snapshot;
  const combatSnapshot = combatRaw && typeof combatRaw === 'object' && !('__coopDungeonMeta' in combatRaw)
    ? combatRaw as BattleState
    : undefined;
  const chamberEnemy = asChamberEnemy(resultRecord.chamberEnemy);
  const abandonedBy = typeof resultRecord.abandonedBy === 'string' ? resultRecord.abandonedBy : undefined;

  const session: CoopDungeonSession = {
    id: row.id,
    schemaVersion: Number(resultRecord.schemaVersion) || 1,
    version: Math.max(1, Math.floor(Number(row.version) || 1)),
    phase: row.phase,
    partyId: typeof resultRecord.partyId === 'string' && resultRecord.partyId
      ? resultRecord.partyId
      : `${hostUsername}|${allyUsername}`.toLowerCase(),
    partyUpdatedAt: Number(resultRecord.partyUpdatedAt) || createdAt,
    dungeonId: row.dungeon_id,
    dungeonSnapshot: asDungeonSnapshot(resultRecord.dungeonSnapshot, row.dungeon_id),
    hostUsername,
    allyUsername,
    seed: typeof row.seed === 'string' && row.seed.trim()
      ? row.seed
      : `${row.dungeon_id}:${row.id}:${createdAt}`,
    chambers: asChambers(row.chambers, row.id),
    currentChamberIndex: Math.max(0, Math.floor(Number(row.current_chamber_index) || 0)),
    createdAt,
    updatedAt,
    expiresAt,
    hostSnapshot: asPlayerSnapshot(resultRecord.hostSnapshot, hostUsername, createdAt),
    allySnapshot: asPlayerSnapshot(resultRecord.allySnapshot, allyUsername, createdAt),
    ...(combatSnapshot ? { combatSnapshot } : {}),
    ...(chamberEnemy ? { chamberEnemy } : {}),
    ...(abandonedBy ? { abandonedBy } : {}),
  };

  return normalizeCoopDungeonSessions([session], now)[0] || session;
}
