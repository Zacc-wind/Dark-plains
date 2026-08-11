import {
  getFieldedMinions,
  type CharacterStats,
  type MinionStack,
  type PartyState,
  type User,
} from './auth';
import {
  applySynchronizedBattleAction,
  createCoopBattleState,
  type BattleState,
  type BattleUserProfile,
  type SynchronizedBattleAction,
  type WorldEnemy,
} from './battle';
import type { WorldDungeon } from './worldEvents';

export type CoopDungeonPhase = 'lobby' | 'chamber' | 'complete' | 'abandoned';

export interface CoopDungeonChamber {
  id: string;
  label: string;
  cleared: boolean;
}

export interface CoopDungeonPlayerSnapshot extends BattleUserProfile {
  capturedAt: number;
}

export interface CoopDungeonSession {
  id: string;
  schemaVersion: number;
  version: number;
  phase: CoopDungeonPhase;
  partyId: string;
  partyUpdatedAt: number;
  dungeonId: string;
  dungeonSnapshot: WorldDungeon;
  hostUsername: string;
  allyUsername: string;
  seed: string;
  chambers: CoopDungeonChamber[];
  currentChamberIndex: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  hostSnapshot: CoopDungeonPlayerSnapshot;
  allySnapshot: CoopDungeonPlayerSnapshot;
  combatSnapshot?: BattleState;
  chamberEnemy?: WorldEnemy;
  abandonedBy?: string;
}

export interface CoopDungeonSessionResult {
  success: boolean;
  session?: CoopDungeonSession;
  duplicate?: boolean;
  error?: string;
}

export type CoopDungeonMemberRole = 'host' | 'ally';

export const COOP_DUNGEON_SCHEMA_VERSION = 1;
export const COOP_DUNGEON_SESSION_TTL_MS = 6 * 60 * 60 * 1000;
export const COOP_DUNGEON_CHAMBER_COUNT = 3;
const COOP_DUNGEON_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const VALID_PHASES = new Set<CoopDungeonPhase>(['lobby', 'chamber', 'complete', 'abandoned']);

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

function getPartyId(party: PartyState): string {
  return party.memberUsernames.map(normalizeUsername).sort().join('|');
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function withVersion(
  session: CoopDungeonSession,
  updates: Partial<CoopDungeonSession>,
  now: number,
): CoopDungeonSession {
  return {
    ...session,
    ...updates,
    version: session.version + 1,
    updatedAt: now,
  };
}

function capturePlayerSnapshot(user: User, now: number): CoopDungeonPlayerSnapshot {
  return {
    username: user.username,
    stats: cloneStats(user.stats),
    selectedModel: user.selectedModel,
    x: user.x,
    y: user.y,
    minions: getFieldedMinions(user).map(cloneMinion),
    capturedAt: now,
  };
}

function cloneDungeon(dungeon: WorldDungeon): WorldDungeon {
  return {
    ...dungeon,
    bossMinionTemplates: [...dungeon.bossMinionTemplates],
  };
}

/** Shared 3-chamber route stub seeded from an active world dungeon. */
export function buildCoopDungeonChambers(dungeon: WorldDungeon): CoopDungeonChamber[] {
  return [
    {
      id: `${dungeon.id}:threshold`,
      label: `${dungeon.name} Threshold`,
      cleared: false,
    },
    {
      id: `${dungeon.id}:depths`,
      label: `${dungeon.name} Depths`,
      cleared: false,
    },
    {
      id: `${dungeon.id}:sanctum`,
      label: `${dungeon.bossName} Sanctum`,
      cleared: false,
    },
  ];
}

function makeChamberMinions(
  templates: readonly string[],
  enemyId: string,
  count: number,
  now: number,
): MinionStack[] {
  const pool = templates.length > 0 ? templates : ['knight-squire', 'darkpriest'];
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: `${enemyId}-minion-${index}`,
    templateId: pool[index % pool.length],
    quantity: 1,
    acquiredAt: now - index,
    fielded: true,
  }));
}

/** Build a chamber enemy from the dungeon snapshot (scout → mid → boss). */
export function buildCoopDungeonChamberEnemy(
  session: CoopDungeonSession,
  chamberIndex = session.currentChamberIndex,
  now = Date.now(),
): WorldEnemy {
  const dungeon = session.dungeonSnapshot;
  const templates = dungeon.bossMinionTemplates;
  const seed = hashText(`${session.seed}:chamber:${chamberIndex}`);
  const baseLevel = Math.max(1, dungeon.level);

  if (chamberIndex <= 0) {
    const level = Math.max(1, baseLevel - 2);
    return {
      id: `${session.id}:chamber-0`,
      name: `${dungeon.name} Scouts`,
      subtitle: 'Outer chamber patrol',
      x: dungeon.x,
      y: dungeon.y,
      level,
      modelNumber: dungeon.bossModelNumber,
      personality: 'balanced',
      minions: makeChamberMinions(templates, `${session.id}-c0`, 2 + (seed % 2), now),
      spawnKind: 'coop-boss',
      lootMultiplier: 1.2,
    };
  }

  if (chamberIndex === 1) {
    const level = Math.max(1, baseLevel - 1);
    return {
      id: `${session.id}:chamber-1`,
      name: `${dungeon.name} Wardens`,
      subtitle: 'Deep corridor defenders',
      x: dungeon.x,
      y: dungeon.y,
      level,
      modelNumber: dungeon.bossModelNumber,
      personality: dungeon.bossPersonality,
      minions: makeChamberMinions(templates, `${session.id}-c1`, 3 + (seed % 2), now),
      spawnKind: 'coop-boss',
      lootMultiplier: 1.8,
    };
  }

  return {
    id: `${session.id}:chamber-boss`,
    bossId: dungeon.bossId,
    name: dungeon.bossName,
    subtitle: dungeon.bossSubtitle,
    story: dungeon.bossStory,
    intro: dungeon.bossIntro,
    artworkPath: dungeon.bossArtworkPath,
    x: dungeon.x,
    y: dungeon.y,
    level: baseLevel,
    modelNumber: dungeon.bossModelNumber,
    personality: 'boss',
    minions: makeChamberMinions(templates, `${session.id}-boss`, 4, now),
    spawnKind: 'coop-boss',
    lootMultiplier: 3.2,
  };
}

export function getCoopDungeonMemberRole(
  session: CoopDungeonSession,
  username: string,
): CoopDungeonMemberRole | null {
  const normalized = normalizeUsername(username);
  if (normalizeUsername(session.hostUsername) === normalized) return 'host';
  if (normalizeUsername(session.allyUsername) === normalized) return 'ally';
  return null;
}

export function getCoopDungeonSnapshot(
  session: CoopDungeonSession,
  username: string,
): CoopDungeonPlayerSnapshot | null {
  const role = getCoopDungeonMemberRole(session, username);
  if (role === 'host') return session.hostSnapshot;
  if (role === 'ally') return session.allySnapshot;
  return null;
}

export function getCurrentCoopDungeonChamber(
  session: CoopDungeonSession,
): CoopDungeonChamber | null {
  return session.chambers[session.currentChamberIndex] || null;
}

export function normalizeCoopDungeonSessions(
  sessions: readonly CoopDungeonSession[] | null | undefined,
  now = Date.now(),
): CoopDungeonSession[] {
  const seen = new Set<string>();
  const normalized: CoopDungeonSession[] = [];

  (sessions || []).forEach(session => {
    const id = typeof session?.id === 'string' ? session.id.trim().slice(0, 180) : '';
    const hostUsername = typeof session?.hostUsername === 'string' ? session.hostUsername.trim() : '';
    const allyUsername = typeof session?.allyUsername === 'string' ? session.allyUsername.trim() : '';
    if (
      !id
      || seen.has(id)
      || !hostUsername
      || !allyUsername
      || normalizeUsername(hostUsername) === normalizeUsername(allyUsername)
      || !session.dungeonSnapshot
      || !session.hostSnapshot
      || !session.allySnapshot
      || !Array.isArray(session.chambers)
      || session.chambers.length < 1
    ) return;

    const createdAt = Number.isFinite(session.createdAt) ? Number(session.createdAt) : now;
    const updatedAt = Number.isFinite(session.updatedAt) ? Number(session.updatedAt) : createdAt;
    if (updatedAt < now - COOP_DUNGEON_RETENTION_MS) return;
    const expiresAt = Number.isFinite(session.expiresAt)
      ? Math.max(createdAt, Number(session.expiresAt))
      : createdAt + COOP_DUNGEON_SESSION_TTL_MS;
    let phase = VALID_PHASES.has(session.phase) ? session.phase : 'lobby';
    if ((phase === 'lobby' || phase === 'chamber') && expiresAt <= now) phase = 'abandoned';
    if (phase === 'chamber' && !session.combatSnapshot) phase = 'lobby';

    const chambers = session.chambers.slice(0, COOP_DUNGEON_CHAMBER_COUNT).map((chamber, index) => ({
      id: typeof chamber?.id === 'string' && chamber.id.trim()
        ? chamber.id.trim()
        : `${id}:chamber-${index}`,
      label: typeof chamber?.label === 'string' && chamber.label.trim()
        ? chamber.label.trim()
        : `Chamber ${index + 1}`,
      cleared: Boolean(chamber?.cleared),
    }));
    while (chambers.length < COOP_DUNGEON_CHAMBER_COUNT) {
      const index = chambers.length;
      chambers.push({
        id: `${id}:chamber-${index}`,
        label: `Chamber ${index + 1}`,
        cleared: false,
      });
    }

    const currentChamberIndex = Math.max(
      0,
      Math.min(chambers.length - 1, Math.floor(Number(session.currentChamberIndex) || 0)),
    );

    seen.add(id);
    normalized.push({
      ...session,
      id,
      schemaVersion: COOP_DUNGEON_SCHEMA_VERSION,
      version: Math.max(1, Math.floor(Number(session.version) || 1)),
      phase,
      hostUsername,
      allyUsername,
      dungeonId: session.dungeonId || session.dungeonSnapshot.id,
      dungeonSnapshot: cloneDungeon(session.dungeonSnapshot),
      chambers,
      currentChamberIndex,
      createdAt,
      updatedAt,
      expiresAt,
      seed: session.seed || `${id}:${createdAt}`,
      ...(session.combatSnapshot ? {
        combatSnapshot: {
          ...session.combatSnapshot,
          mode: 'coop' as const,
          revision: Math.max(0, Math.floor(Number(session.combatSnapshot.revision) || 0)),
          processedActionIds: Array.from(new Set(session.combatSnapshot.processedActionIds || [])).slice(0, 240),
        },
      } : {}),
    });
  });

  return normalized.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 20);
}

export function createCoopDungeonSession(
  party: PartyState,
  host: User,
  ally: User,
  dungeon: WorldDungeon,
  now = Date.now(),
): CoopDungeonSessionResult {
  const members = party.memberUsernames.map(normalizeUsername);
  if (members.length !== 2) {
    return { success: false, error: 'Duo dungeon routes require exactly two party members.' };
  }
  if (normalizeUsername(party.leaderUsername) !== normalizeUsername(host.username)) {
    return { success: false, error: 'Only the party leader can open a dungeon route.' };
  }
  if (!members.includes(normalizeUsername(host.username)) || !members.includes(normalizeUsername(ally.username))) {
    return { success: false, error: 'Dungeon profiles do not match the current party.' };
  }
  if ((dungeon.expiresAt || now + 1) <= now) {
    return { success: false, error: 'That dungeon is no longer active.' };
  }
  const requiredLevel = Math.max(5, dungeon.requiredPlayerLevel || 5);
  if (host.stats.level < requiredLevel || ally.stats.level < requiredLevel) {
    return { success: false, error: `Both commanders must reach level ${requiredLevel}.` };
  }

  const hostSnapshot = capturePlayerSnapshot(host, now);
  const allySnapshot = capturePlayerSnapshot(ally, now);
  if (hostSnapshot.minions.length === 0 || allySnapshot.minions.length === 0) {
    return { success: false, error: 'Each commander must field at least one unit before entering the route.' };
  }

  const partyId = getPartyId(party);
  const chambers = buildCoopDungeonChambers(dungeon);
  const session: CoopDungeonSession = {
    id: `coop-dungeon-${dungeon.id}-${hashText(`${partyId}:${party.updatedAt}`)}`,
    schemaVersion: COOP_DUNGEON_SCHEMA_VERSION,
    version: 1,
    phase: 'lobby',
    partyId,
    partyUpdatedAt: party.updatedAt,
    dungeonId: dungeon.id,
    dungeonSnapshot: cloneDungeon(dungeon),
    hostUsername: host.username,
    allyUsername: ally.username,
    seed: `${dungeon.id}:${partyId}:${now}`,
    chambers,
    currentChamberIndex: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: Math.min(
      dungeon.expiresAt || now + COOP_DUNGEON_SESSION_TTL_MS,
      now + COOP_DUNGEON_SESSION_TTL_MS,
    ),
    hostSnapshot,
    allySnapshot,
  };
  return { success: true, session };
}

export function startCoopDungeonChamber(
  session: CoopDungeonSession,
  expectedVersion: number,
  now = Date.now(),
): CoopDungeonSessionResult {
  if (session.phase !== 'lobby') {
    return { success: false, session, error: 'A chamber is already underway or the route is closed.' };
  }
  if (session.expiresAt <= now) {
    return {
      success: false,
      session: withVersion(session, { phase: 'abandoned' }, now),
      error: 'Dungeon route expired.',
    };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Dungeon session changed. Refresh before starting.' };
  }
  const chamber = getCurrentCoopDungeonChamber(session);
  if (!chamber || chamber.cleared) {
    return { success: false, session, error: 'No uncleared chamber remains.' };
  }

  const enemy = buildCoopDungeonChamberEnemy(session, session.currentChamberIndex, now);
  const combatSnapshot = createCoopBattleState(
    session.hostSnapshot,
    session.allySnapshot,
    enemy,
    {
      battleId: `battle-${session.id}-c${session.currentChamberIndex}`,
      now,
    },
  );

  return {
    success: true,
    session: withVersion(session, {
      phase: 'chamber',
      chamberEnemy: enemy,
      combatSnapshot,
    }, now),
  };
}

export function advanceChamber(
  session: CoopDungeonSession,
  expectedVersion: number,
  now = Date.now(),
): CoopDungeonSessionResult {
  if (session.phase !== 'chamber' && session.phase !== 'lobby') {
    return { success: false, session, error: 'This dungeon route can no longer advance.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Dungeon session changed. Refresh before advancing.' };
  }

  const index = session.currentChamberIndex;
  const chamber = session.chambers[index];
  if (!chamber) return { success: false, session, error: 'No chamber to clear.' };
  if (chamber.cleared) return { success: true, session, duplicate: true };

  const chambers = session.chambers.map((entry, entryIndex) => (
    entryIndex === index ? { ...entry, cleared: true } : entry
  ));
  const nextIndex = index + 1;
  const complete = nextIndex >= chambers.length;

  return {
    success: true,
    session: withVersion(session, {
      chambers,
      currentChamberIndex: complete ? index : nextIndex,
      phase: complete ? 'complete' : 'lobby',
      combatSnapshot: undefined,
      chamberEnemy: undefined,
    }, now),
  };
}

export function abandonCoopDungeonSession(
  session: CoopDungeonSession,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): CoopDungeonSessionResult {
  if (!getCoopDungeonMemberRole(session, username)) {
    return { success: false, session, error: 'Player is not part of this dungeon route.' };
  }
  if (session.phase === 'abandoned') return { success: true, session, duplicate: true };
  if (session.phase === 'complete') {
    return { success: false, session, error: 'Completed routes cannot be abandoned.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Dungeon session changed. Refresh before abandoning.' };
  }
  return {
    success: true,
    session: withVersion(session, {
      phase: 'abandoned',
      abandonedBy: username,
      combatSnapshot: undefined,
      chamberEnemy: undefined,
    }, now),
  };
}

export function applyCoopDungeonAction(
  session: CoopDungeonSession,
  action: SynchronizedBattleAction,
  expectedVersion: number,
  now = Date.now(),
): CoopDungeonSessionResult {
  if (session.phase !== 'chamber' || !session.combatSnapshot) {
    return { success: false, session, error: 'No active chamber battle.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Dungeon session changed. Refresh before acting.' };
  }
  if (!getCoopDungeonMemberRole(session, action.actorUsername)) {
    return { success: false, session, error: 'Actor is not part of this dungeon route.' };
  }

  const applied = applySynchronizedBattleAction(session.combatSnapshot, action, now);
  if (!applied.success) {
    return { success: false, session, error: applied.error || 'Chamber command failed.' };
  }
  if (applied.duplicate) return { success: true, session, duplicate: true };

  let nextSession = withVersion(session, { combatSnapshot: applied.state }, now);
  if (applied.state.status === 'victory') {
    return advanceChamber(nextSession, nextSession.version, now);
  }
  if (applied.state.status === 'defeat') {
    nextSession = withVersion(nextSession, {
      phase: 'lobby',
      combatSnapshot: undefined,
      chamberEnemy: undefined,
    }, now);
  }
  return { success: true, session: nextSession };
}
