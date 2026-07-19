import {
  DEFAULT_EQUIPPED_SPELL_IDS,
  getFieldedMinions,
  type CharacterStats,
  type EquipmentRarity,
  type MinionStack,
  type PartyState,
  type User,
} from './auth';
import {
  COOP_PLAYER_FIELD_MINIONS,
  applySynchronizedBattleAction,
  createCoopBattleState,
  type BattleState,
  type BattleUserProfile,
  type SynchronizedBattleAction,
  type WorldEnemy,
} from './battle';
import {
  getFormationIssue,
  getPlacedFormationStacks,
  makeDefaultFormation,
  mergeFormation,
} from './formation';
import { scaleMultiplayerRewards } from './multiplayerRewards';

export type CoopRaidPhase = 'formation' | 'active' | 'completed' | 'abandoned' | 'expired';
export type CoopRaidOutcome = 'victory' | 'defeat' | 'abandoned';
export type CoopRaidMemberRole = 'host' | 'ally';

export interface CoopRaidPlayerSnapshot extends BattleUserProfile {
  knownSpellIds: string[];
  equippedSpellIds: string[];
  capturedAt: number;
}

export interface CoopRaidFormationState {
  username: string;
  placements: Record<string, { x: number; y: number }>;
  equippedSpellIds: string[];
  confirmedAt?: number;
}

export interface CoopRaidReward {
  gold: number;
  exp: number;
  rareGems: number;
  equipmentRarity: EquipmentRarity;
}

export interface CoopRaidClaimReceipt {
  username: string;
  claimedAt: number;
  reward: CoopRaidReward;
  equipmentName?: string;
}

export interface CoopRaidResult {
  outcome: CoopRaidOutcome;
  completedAt: number;
  finalBattleRevision: number;
  claimReceipts: CoopRaidClaimReceipt[];
}

export interface CoopRaidSession {
  id: string;
  schemaVersion: number;
  version: number;
  phase: CoopRaidPhase;
  partyId: string;
  partyUpdatedAt: number;
  bossId: string;
  bossSnapshot: WorldEnemy;
  hostUsername: string;
  allyUsername: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  seed: string;
  hostSnapshot: CoopRaidPlayerSnapshot;
  allySnapshot: CoopRaidPlayerSnapshot;
  hostFormation: CoopRaidFormationState;
  allyFormation: CoopRaidFormationState;
  combatSnapshot?: BattleState;
  result?: CoopRaidResult;
  abandonedBy?: string;
}

export interface CoopRaidSessionResult {
  success: boolean;
  session?: CoopRaidSession;
  duplicate?: boolean;
  error?: string;
}

export const COOP_RAID_SCHEMA_VERSION = 1;
export const COOP_RAID_SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const COOP_RAID_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const VALID_PHASES = new Set<CoopRaidPhase>(['formation', 'active', 'completed', 'abandoned', 'expired']);

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

function capturePlayerSnapshot(user: User, now: number): CoopRaidPlayerSnapshot {
  const equippedSpellIds = normalizeSpellIds(user.equippedSpellIds);
  const knownSpellIds = Array.from(new Set([
    ...(user.knownSpellIds || DEFAULT_EQUIPPED_SPELL_IDS),
    ...equippedSpellIds,
  ])).slice(0, 40);
  return {
    username: user.username,
    stats: cloneStats(user.stats),
    selectedModel: user.selectedModel,
    x: user.x,
    y: user.y,
    minions: getFieldedMinions(user).map(cloneMinion),
    knownSpellIds,
    equippedSpellIds,
    capturedAt: now,
  };
}

function makeFormationState(snapshot: CoopRaidPlayerSnapshot): CoopRaidFormationState {
  return {
    username: snapshot.username,
    placements: makeDefaultFormation(snapshot.minions.slice(0, COOP_PLAYER_FIELD_MINIONS)),
    equippedSpellIds: [...snapshot.equippedSpellIds],
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
  session: CoopRaidSession,
  updates: Partial<CoopRaidSession>,
  now: number,
): CoopRaidSession {
  return {
    ...session,
    ...updates,
    version: session.version + 1,
    updatedAt: now,
  };
}

export function getCoopRaidMemberRole(
  session: CoopRaidSession,
  username: string,
): CoopRaidMemberRole | null {
  const normalized = normalizeUsername(username);
  if (normalizeUsername(session.hostUsername) === normalized) return 'host';
  if (normalizeUsername(session.allyUsername) === normalized) return 'ally';
  return null;
}

export function getCoopRaidSnapshot(
  session: CoopRaidSession,
  username: string,
): CoopRaidPlayerSnapshot | null {
  const role = getCoopRaidMemberRole(session, username);
  if (role === 'host') return session.hostSnapshot;
  if (role === 'ally') return session.allySnapshot;
  return null;
}

export function getCoopRaidFormation(
  session: CoopRaidSession,
  username: string,
): CoopRaidFormationState | null {
  const role = getCoopRaidMemberRole(session, username);
  if (role === 'host') return session.hostFormation;
  if (role === 'ally') return session.allyFormation;
  return null;
}

export function getCoopRaidReward(session: CoopRaidSession, username: string): CoopRaidReward {
  const seed = hashText(`${session.seed}:${normalizeUsername(username)}:reward`);
  const level = Math.max(1, session.bossSnapshot.level || 1);
  const baseGold = (20 + level * 4) * 4.8;
  const baseExp = (5 + level * 1.5) * 4.8;
  const playerLevel = getCoopRaidSnapshot(session, username)?.stats.level || 1;
  const scaledReward = scaleMultiplayerRewards({
    gold: Math.round(baseGold * (0.9 + (seed % 11) / 100)),
    exp: Math.round(baseExp * (0.9 + ((seed >>> 5) % 11) / 100)),
  }, playerLevel, 'coop');
  return {
    gold: scaledReward.gold,
    exp: scaledReward.exp,
    rareGems: 2 + ((seed >>> 10) % (level >= 18 ? 4 : 3)),
    equipmentRarity: ((seed >>> 15) % 100) < Math.min(35, 10 + level)
      ? 'legendary'
      : 'epic',
  };
}

export function normalizeCoopRaidSessions(
  sessions: readonly CoopRaidSession[] | null | undefined,
  now = Date.now(),
): CoopRaidSession[] {
  const seen = new Set<string>();
  const normalized: CoopRaidSession[] = [];

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
      || !session.hostSnapshot
      || !session.allySnapshot
      || !session.hostFormation
      || !session.allyFormation
      || !session.bossSnapshot
    ) return;

    const createdAt = Number.isFinite(session.createdAt) ? Number(session.createdAt) : now;
    const updatedAt = Number.isFinite(session.updatedAt) ? Number(session.updatedAt) : createdAt;
    if (updatedAt < now - COOP_RAID_RETENTION_MS) return;
    const expiresAt = Number.isFinite(session.expiresAt)
      ? Math.max(createdAt, Number(session.expiresAt))
      : createdAt + COOP_RAID_SESSION_TTL_MS;
    let phase = VALID_PHASES.has(session.phase) ? session.phase : 'formation';
    if ((phase === 'formation' || phase === 'active') && expiresAt <= now) phase = 'expired';
    if (phase === 'active' && !session.combatSnapshot) phase = 'formation';
    if (phase === 'completed' && !session.result) phase = 'abandoned';

    seen.add(id);
    normalized.push({
      ...session,
      id,
      schemaVersion: COOP_RAID_SCHEMA_VERSION,
      version: Math.max(1, Math.floor(Number(session.version) || 1)),
      phase,
      hostUsername,
      allyUsername,
      createdAt,
      updatedAt,
      expiresAt,
      seed: session.seed || `${id}:${createdAt}`,
      ...(session.combatSnapshot ? {
        combatSnapshot: {
          ...session.combatSnapshot,
          mode: 'coop',
          revision: Math.max(0, Math.floor(Number(session.combatSnapshot.revision) || 0)),
          processedActionIds: Array.from(new Set(session.combatSnapshot.processedActionIds || [])).slice(0, 240),
        },
      } : {}),
      ...(session.result ? {
        result: {
          ...session.result,
          claimReceipts: Array.from(new Map((session.result.claimReceipts || []).map(receipt => (
            [normalizeUsername(receipt.username), receipt]
          ))).values()),
        },
      } : {}),
    });
  });

  return normalized.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 20);
}

export function createCoopRaidSession(
  party: PartyState,
  host: User,
  ally: User,
  boss: WorldEnemy,
  now = Date.now(),
): CoopRaidSessionResult {
  const members = party.memberUsernames.map(normalizeUsername);
  if (members.length !== 2) return { success: false, error: 'The first co-op raid requires exactly two party members.' };
  if (normalizeUsername(party.leaderUsername) !== normalizeUsername(host.username)) {
    return { success: false, error: 'Only the party leader can create a raid session.' };
  }
  if (!members.includes(normalizeUsername(host.username)) || !members.includes(normalizeUsername(ally.username))) {
    return { success: false, error: 'Raid profiles do not match the current party.' };
  }
  if (boss.spawnKind !== 'coop-boss') return { success: false, error: 'That encounter is not a co-op raid.' };
  if ((boss.expiresAt || now + 1) <= now) return { success: false, error: 'That co-op incursion has expired.' };
  const requiredLevel = Math.max(5, boss.requiredPlayerLevel || 5);
  if (host.stats.level < requiredLevel || ally.stats.level < requiredLevel) {
    return { success: false, error: `Both commanders must reach level ${requiredLevel}.` };
  }

  const hostSnapshot = capturePlayerSnapshot(host, now);
  const allySnapshot = capturePlayerSnapshot(ally, now);
  if (hostSnapshot.minions.length === 0 || allySnapshot.minions.length === 0) {
    return { success: false, error: 'Each commander must field at least one unit before preparing the raid.' };
  }

  const partyId = getPartyId(party);
  const session: CoopRaidSession = {
    id: `coop-raid-${boss.id}-${hashText(`${partyId}:${party.updatedAt}`)}`,
    schemaVersion: COOP_RAID_SCHEMA_VERSION,
    version: 1,
    phase: 'formation',
    partyId,
    partyUpdatedAt: party.updatedAt,
    bossId: boss.id,
    bossSnapshot: { ...boss, minions: boss.minions.map(cloneMinion) },
    hostUsername: host.username,
    allyUsername: ally.username,
    createdAt: now,
    updatedAt: now,
    expiresAt: Math.min(boss.expiresAt || now + COOP_RAID_SESSION_TTL_MS, now + COOP_RAID_SESSION_TTL_MS),
    seed: `${boss.id}:${partyId}:${now}`,
    hostSnapshot,
    allySnapshot,
    hostFormation: makeFormationState(hostSnapshot),
    allyFormation: makeFormationState(allySnapshot),
  };
  return { success: true, session };
}

export function confirmCoopRaidFormation(
  session: CoopRaidSession,
  username: string,
  placements: Record<string, { x: number; y: number }>,
  equippedSpellIds: string[],
  expectedVersion: number,
  now = Date.now(),
): CoopRaidSessionResult {
  if (session.phase !== 'formation') return { success: false, session, error: 'Raid formation is closed.' };
  if (session.expiresAt <= now) {
    return { success: false, session: { ...session, phase: 'expired', updatedAt: now }, error: 'Raid session expired.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Raid session changed. Refresh before confirming.' };
  }
  const role = getCoopRaidMemberRole(session, username);
  if (!role) return { success: false, session, error: 'Player is not part of this raid.' };
  const snapshot = role === 'host' ? session.hostSnapshot : session.allySnapshot;
  const currentFormation = role === 'host' ? session.hostFormation : session.allyFormation;
  if (currentFormation.confirmedAt) return { success: true, session, duplicate: true };

  const mergedPlacements = mergeFormation(snapshot.minions, placements, COOP_PLAYER_FIELD_MINIONS);
  const placedStacks = getPlacedFormationStacks(snapshot.minions, mergedPlacements);
  if (placedStacks.length === 0) return { success: false, session, error: 'Field at least one unit for the raid.' };
  if (placedStacks.length > COOP_PLAYER_FIELD_MINIONS) {
    return { success: false, session, error: `Field no more than ${COOP_PLAYER_FIELD_MINIONS} units.` };
  }
  const issue = getFormationIssue(mergedPlacements, placedStacks);
  if (issue) return { success: false, session, error: issue };
  const knownSpellIds = new Set(snapshot.knownSpellIds);
  const normalizedSpellIds = normalizeSpellIds(equippedSpellIds);
  if (normalizedSpellIds.some(spellId => !knownSpellIds.has(spellId))) {
    return { success: false, session, error: 'Raid loadout contains an unknown spell.' };
  }

  const confirmed: CoopRaidFormationState = {
    username: snapshot.username,
    placements: mergedPlacements,
    equippedSpellIds: normalizedSpellIds,
    confirmedAt: now,
  };
  let nextSession = withVersion(session, role === 'host'
    ? { hostFormation: confirmed }
    : { allyFormation: confirmed }, now);

  if (nextSession.hostFormation.confirmedAt && nextSession.allyFormation.confirmedAt) {
    const hostStacks = getPlacedFormationStacks(nextSession.hostSnapshot.minions, nextSession.hostFormation.placements);
    const allyStacks = getPlacedFormationStacks(nextSession.allySnapshot.minions, nextSession.allyFormation.placements);
    nextSession = {
      ...nextSession,
      phase: 'active',
      combatSnapshot: createCoopBattleState(
        nextSession.hostSnapshot,
        nextSession.allySnapshot,
        nextSession.bossSnapshot,
        {
          battleId: `battle-${nextSession.id}`,
          hostStacks,
          allyStacks,
          hostFormation: nextSession.hostFormation.placements,
          allyFormation: nextSession.allyFormation.placements,
          now,
        },
      ),
    };
  }

  return { success: true, session: nextSession };
}

function completeFromBattle(
  session: CoopRaidSession,
  battle: BattleState,
  now: number,
): CoopRaidSessionResult {
  if (battle.status === 'active') return { success: true, session };
  if (battle.status === 'recruited') return { success: false, session, error: 'Recruit outcomes are not valid in a raid.' };
  return {
    success: true,
    session: withVersion(session, {
      phase: 'completed',
      combatSnapshot: battle,
      result: {
        outcome: battle.status === 'victory' ? 'victory' : 'defeat',
        completedAt: now,
        finalBattleRevision: battle.revision || 0,
        claimReceipts: [],
      },
    }, now),
  };
}

export function applyCoopRaidAction(
  session: CoopRaidSession,
  action: SynchronizedBattleAction,
  expectedVersion: number,
  now = Date.now(),
): CoopRaidSessionResult {
  if (session.phase !== 'active' || !session.combatSnapshot) {
    return { success: false, session, error: 'Raid combat is not active.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Raid session changed. Refresh before acting.' };
  }
  const role = getCoopRaidMemberRole(session, action.actorUsername);
  if (!role) return { success: false, session, error: 'Player is not part of this raid.' };
  if (action.type === 'cast-spell') {
    const formation = role === 'host' ? session.hostFormation : session.allyFormation;
    if (!action.spellId || !formation.equippedSpellIds.includes(action.spellId)) {
      return { success: false, session, error: 'That spell is not equipped for this raid.' };
    }
  }

  const actionResult = applySynchronizedBattleAction(session.combatSnapshot, action, now);
  if (!actionResult.success) return { success: false, session, error: actionResult.error };
  if (actionResult.duplicate) return { success: true, session, duplicate: true };
  if (actionResult.state.status !== 'active') return completeFromBattle(session, actionResult.state, now);
  return {
    success: true,
    session: withVersion(session, { combatSnapshot: actionResult.state }, now),
  };
}

export function abandonCoopRaidSession(
  session: CoopRaidSession,
  username: string,
  expectedVersion: number,
  now = Date.now(),
): CoopRaidSessionResult {
  if (!getCoopRaidMemberRole(session, username)) {
    return { success: false, session, error: 'Player is not part of this raid.' };
  }
  if (session.phase === 'abandoned') return { success: true, session, duplicate: true };
  if (session.phase !== 'formation' && session.phase !== 'active') {
    return { success: false, session, error: 'Raid can no longer be abandoned.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Raid session changed. Refresh before abandoning.' };
  }
  if (session.phase === 'formation') {
    return {
      success: true,
      session: withVersion(session, { phase: 'abandoned', abandonedBy: username }, now),
    };
  }
  return {
    success: true,
    session: withVersion(session, {
      phase: 'completed',
      abandonedBy: username,
      result: {
        outcome: 'abandoned',
        completedAt: now,
        finalBattleRevision: session.combatSnapshot?.revision || 0,
        claimReceipts: [],
      },
    }, now),
  };
}

export function markCoopRaidClaimed(
  session: CoopRaidSession,
  username: string,
  expectedVersion: number,
  equipmentName: string | undefined,
  now = Date.now(),
): CoopRaidSessionResult {
  if (session.phase !== 'completed' || !session.result) {
    return { success: false, session, error: 'Raid result is not ready.' };
  }
  if (session.version !== expectedVersion) {
    return { success: false, session, error: 'Raid session changed. Refresh before claiming.' };
  }
  if (!getCoopRaidMemberRole(session, username)) {
    return { success: false, session, error: 'Player is not part of this raid.' };
  }
  if (session.result.claimReceipts.some(receipt => normalizeUsername(receipt.username) === normalizeUsername(username))) {
    return { success: true, session, duplicate: true };
  }
  const reward = session.result.outcome === 'victory'
    ? getCoopRaidReward(session, username)
    : { gold: 0, exp: 0, rareGems: 0, equipmentRarity: 'epic' as const };
  return {
    success: true,
    session: withVersion(session, {
      result: {
        ...session.result,
        claimReceipts: [
          ...session.result.claimReceipts,
          { username, claimedAt: now, reward, ...(equipmentName ? { equipmentName } : {}) },
        ],
      },
    }, now),
  };
}
