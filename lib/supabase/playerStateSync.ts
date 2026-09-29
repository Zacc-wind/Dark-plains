import { MAX_PLAYER_LEVEL, type User } from '@/lib/playerTypes';

/** Soft caps so a malicious client cannot dump unbounded JSON into player_states. */
export const PLAYER_SYNC_MAX_INVENTORY_ITEMS = 200;
export const PLAYER_SYNC_MAX_EQUIPMENT_ITEMS = 200;
export const PLAYER_SYNC_MAX_MINIONS = 100;
export const PLAYER_SYNC_MAX_ACTIVITY_LOG = 200;
export const PLAYER_SYNC_MAX_JOB_QUEUE = 50;
export const PLAYER_SYNC_SELECTED_MODEL_MIN = 1;
export const PLAYER_SYNC_SELECTED_MODEL_MAX = 6;

export interface PlayerSyncValidationContext {
  authUserId: string;
  profileUsername: string;
}

export type PlayerSyncValidationResult =
  | { ok: true; player: User }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function readLevel(player: Record<string, unknown>): number | null {
  const stats = isPlainObject(player.stats) ? player.stats : null;
  const fromStats = stats ? asFiniteNumber(stats.level) : null;
  if (fromStats !== null) return Math.floor(fromStats);
  const topLevel = asFiniteNumber(player.level);
  if (topLevel !== null) return Math.floor(topLevel);
  return null;
}

function assertArrayBound(
  value: unknown,
  label: string,
  max: number,
): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return `${label} must be an array.`;
  if (value.length > max) return `${label} exceeds the sync limit of ${max}.`;
  return null;
}

/**
 * Light validation for server-side player_states sync.
 * Ownership is enforced via authUserId; username must match the existing profile.
 */
export function validatePlayerSyncPayload(
  body: unknown,
  context: PlayerSyncValidationContext,
): PlayerSyncValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Invalid request body.' };
  }

  const playerRaw = body.player;
  if (!isPlainObject(playerRaw)) {
    return { ok: false, error: 'Missing player payload.' };
  }

  const claimedUserId = body.userId ?? body.user_id ?? playerRaw.userId ?? playerRaw.user_id;
  if (claimedUserId !== undefined && String(claimedUserId) !== context.authUserId) {
    return { ok: false, error: 'Player state user id does not match the authenticated user.' };
  }

  const username = String(playerRaw.username ?? '').trim();
  if (!username) {
    return { ok: false, error: 'Username is required.' };
  }
  if (username !== context.profileUsername) {
    return { ok: false, error: 'Username does not match the authenticated profile.' };
  }

  const level = readLevel(playerRaw);
  if (level === null) {
    return { ok: false, error: 'Player level is required.' };
  }
  if (level < 1 || level > MAX_PLAYER_LEVEL) {
    return { ok: false, error: `Player level must be between 1 and ${MAX_PLAYER_LEVEL}.` };
  }

  const gold = asFiniteNumber(playerRaw.gold);
  if (gold === null || gold < 0) {
    return { ok: false, error: 'Gold must be a non-negative number.' };
  }

  const exp = asFiniteNumber(playerRaw.exp);
  if (exp === null || exp < 0) {
    return { ok: false, error: 'Experience must be a non-negative number.' };
  }

  const selectedModel = asFiniteNumber(playerRaw.selectedModel);
  if (
    selectedModel !== null
    && (
      selectedModel < PLAYER_SYNC_SELECTED_MODEL_MIN
      || selectedModel > PLAYER_SYNC_SELECTED_MODEL_MAX
      || !Number.isInteger(selectedModel)
    )
  ) {
    return {
      ok: false,
      error: `selectedModel must be an integer from ${PLAYER_SYNC_SELECTED_MODEL_MIN} to ${PLAYER_SYNC_SELECTED_MODEL_MAX}.`,
    };
  }

  const bounds = [
    assertArrayBound(playerRaw.inventory, 'inventory', PLAYER_SYNC_MAX_INVENTORY_ITEMS),
    assertArrayBound(playerRaw.equipment, 'equipment', PLAYER_SYNC_MAX_EQUIPMENT_ITEMS),
    assertArrayBound(playerRaw.minions, 'minions', PLAYER_SYNC_MAX_MINIONS),
    assertArrayBound(playerRaw.activityLog, 'activityLog', PLAYER_SYNC_MAX_ACTIVITY_LOG),
    assertArrayBound(playerRaw.jobQueue, 'jobQueue', PLAYER_SYNC_MAX_JOB_QUEUE),
  ];
  for (const boundError of bounds) {
    if (boundError) return { ok: false, error: boundError };
  }

  const player = playerRaw as unknown as User;
  if (isPlainObject(player.stats)) {
    player.stats = {
      ...player.stats,
      level,
    };
  }

  return { ok: true, player };
}

/** Status codes where the browser may fall back to direct Supabase upsert (local / not ready). */
export function shouldFallbackPlayerSyncToDirectWrite(status: number): boolean {
  return status === 501 || status === 503;
}
