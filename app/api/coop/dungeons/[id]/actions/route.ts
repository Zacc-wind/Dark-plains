import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import type { SynchronizedBattleAction } from '@/lib/battle';
import {
  coopDungeonSessionFromDbRow,
  coopDungeonSessionToDbPayload,
  getCoopDungeonSessionAdminClient,
  shouldUseOnlineCoopDungeonSessions,
  type CoopDungeonSessionDbRow,
} from '@/lib/coopDungeonSessionDb';
import { applyCoopDungeonAction, type CoopDungeonSession } from '@/lib/coopDungeonSessions';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';
import { getAuthenticatedUserId } from '@/lib/supabase/requireAuth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = NonNullable<ReturnType<typeof getCoopDungeonSessionAdminClient>>;

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ProfileRow {
  id: string;
  username: string;
}

async function getPlayerLevel(supabase: SupabaseServerClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('player_states')
    .select('level')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.level) || 1;
}

async function loadRow(admin: AdminClient, sessionId: string): Promise<CoopDungeonSessionDbRow | null> {
  const { data, error } = await admin
    .from('coop_dungeon_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data as CoopDungeonSessionDbRow | null;
}

async function getUsernameMap(admin: AdminClient, ids: string[]): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, username')
    .in('id', ids);
  if (error) throw error;
  return new Map((data as ProfileRow[] | null || []).map(profile => [profile.id, profile.username]));
}

function hydrate(
  row: CoopDungeonSessionDbRow,
  usernameById: Map<string, string>,
  now = Date.now(),
): CoopDungeonSession | null {
  const hostUsername = usernameById.get(row.host_id);
  const allyUsername = usernameById.get(row.ally_id);
  if (!hostUsername || !allyUsername) return null;
  return coopDungeonSessionFromDbRow(row, hostUsername, allyUsername, now);
}

async function writeVersioned(
  admin: AdminClient,
  session: CoopDungeonSession,
  hostId: string,
  allyId: string,
  expectedVersion: number,
): Promise<CoopDungeonSessionDbRow | null> {
  const payload = coopDungeonSessionToDbPayload(session, hostId, allyId);
  const { data, error } = await admin
    .from('coop_dungeon_sessions')
    .update({
      phase: payload.phase,
      version: payload.version,
      seed: payload.seed,
      chambers: payload.chambers,
      current_chamber_index: payload.current_chamber_index,
      combat_snapshot: payload.combat_snapshot,
      result: payload.result,
      expires_at: payload.expires_at,
      updated_at: new Date(session.updatedAt).toISOString(),
    })
    .eq('id', session.id)
    .eq('version', expectedVersion)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as CoopDungeonSessionDbRow | null;
}

function conflictResponse(session: CoopDungeonSession, error: string) {
  return Response.json(
    { ok: false, error, data: { session }, deploymentMode: 'database' },
    { status: 409 },
  );
}

function isSynchronizedBattleAction(value: unknown): value is SynchronizedBattleAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Partial<SynchronizedBattleAction>;
  return typeof action.id === 'string'
    && typeof action.type === 'string'
    && typeof action.actorUsername === 'string'
    && Number.isFinite(action.expectedRevision)
    && Number.isFinite(action.createdAt);
}

export async function POST(request: Request, context: RouteContext) {
  if (!shouldUseOnlineCoopDungeonSessions()) {
    return apiNotConfigured('Co-op dungeon action API');
  }

  const { id } = await context.params;
  let body: { action?: SynchronizedBattleAction; expectedVersion?: number };

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const expectedVersion = Math.floor(Number(body.expectedVersion));
  if (!isSynchronizedBattleAction(body.action)) {
    return Response.json({ ok: false, error: 'Invalid dungeon combat action.', deploymentMode: 'database' }, { status: 400 });
  }
  if (!Number.isFinite(expectedVersion) || expectedVersion < 1) {
    return Response.json({ ok: false, error: 'expectedVersion is required.', deploymentMode: 'database' }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = getCoopDungeonSessionAdminClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId || !admin) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  try {
    const unlock = requireMultiplayerUnlock('coop-dungeons', await getPlayerLevel(supabase, userId));
    if (!unlock.allowed) {
      return Response.json({ ok: false, error: unlock.error, deploymentMode: 'database' }, { status: 403 });
    }

    const row = await loadRow(admin, id);
    if (!row) {
      return Response.json({ ok: false, error: 'Dungeon session was not found.', deploymentMode: 'database' }, { status: 404 });
    }
    if (row.host_id !== userId && row.ally_id !== userId) {
      return Response.json({ ok: false, error: 'You are not part of this dungeon route.', deploymentMode: 'database' }, { status: 403 });
    }

    const usernameById = await getUsernameMap(admin, [row.host_id, row.ally_id]);
    const username = usernameById.get(userId);
    if (!username) {
      return Response.json({ ok: false, error: 'Your profile is missing.', deploymentMode: 'database' }, { status: 404 });
    }

    const action = body.action;
    if (action.actorUsername.toLowerCase() !== username.toLowerCase()) {
      return Response.json({ ok: false, error: 'Action actor must match the authenticated player.', deploymentMode: 'database' }, { status: 403 });
    }

    const now = Date.now();
    const session = hydrate(row, usernameById, now);
    if (!session) {
      return Response.json({ ok: false, error: 'Dungeon session could not be loaded.', deploymentMode: 'database' }, { status: 500 });
    }

    // Idempotency via combat_snapshot.processedActionIds (no coop_dungeon_actions table).
    const actionId = action.id.trim().slice(0, 180);
    if (actionId && (session.combatSnapshot?.processedActionIds || []).includes(actionId)) {
      return apiOk({ session, duplicate: true }, undefined, 'database');
    }

    if (session.version !== expectedVersion) {
      return conflictResponse(session, 'Dungeon session changed. Refresh before acting.');
    }

    const applied = applyCoopDungeonAction(session, action, expectedVersion, now);
    if (!applied.success || !applied.session) {
      return Response.json({
        ok: false,
        error: applied.error || 'Could not apply dungeon action.',
        data: { session: applied.session || session },
        deploymentMode: 'database',
      }, { status: 409 });
    }

    if (applied.duplicate) {
      return apiOk({ session: applied.session, duplicate: true }, undefined, 'database');
    }

    const written = await writeVersioned(
      admin,
      applied.session,
      row.host_id,
      row.ally_id,
      expectedVersion,
    );
    if (!written) {
      const fresh = await loadRow(admin, id);
      const freshSession = fresh ? hydrate(fresh, usernameById, now) : session;
      return conflictResponse(freshSession || session, 'Dungeon session changed. Refresh before acting.');
    }

    const saved = hydrate(written, usernameById, now) || applied.session;
    return apiOk({ session: saved }, undefined, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply dungeon action.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
