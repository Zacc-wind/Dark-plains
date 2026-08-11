import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import type { SynchronizedBattleAction } from '@/lib/battle';
import {
  coopRaidSessionFromDbRow,
  coopRaidSessionToDbPayload,
  getCoopRaidSessionAdminClient,
  shouldUseOnlineCoopRaidSessions,
  type CoopRaidSessionDbRow,
} from '@/lib/coopRaidSessionDb';
import { applyCoopRaidAction, type CoopRaidSession } from '@/lib/coopRaidSessions';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = NonNullable<ReturnType<typeof getCoopRaidSessionAdminClient>>;

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ProfileRow {
  id: string;
  username: string;
}

async function getAuthenticatedUserId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
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

async function loadRow(admin: AdminClient, sessionId: string): Promise<CoopRaidSessionDbRow | null> {
  const { data, error } = await admin
    .from('coop_raid_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data as CoopRaidSessionDbRow | null;
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
  row: CoopRaidSessionDbRow,
  usernameById: Map<string, string>,
  now = Date.now(),
): CoopRaidSession | null {
  const hostUsername = usernameById.get(row.host_id);
  const allyUsername = usernameById.get(row.ally_id);
  if (!hostUsername || !allyUsername) return null;
  return coopRaidSessionFromDbRow(row, hostUsername, allyUsername, now);
}

async function writeVersioned(
  admin: AdminClient,
  session: CoopRaidSession,
  hostId: string,
  allyId: string,
  expectedVersion: number,
): Promise<CoopRaidSessionDbRow | null> {
  const payload = coopRaidSessionToDbPayload(session, hostId, allyId);
  const { data, error } = await admin
    .from('coop_raid_sessions')
    .update({
      phase: payload.phase,
      version: payload.version,
      boss_snapshot: payload.boss_snapshot,
      host_snapshot: payload.host_snapshot,
      ally_snapshot: payload.ally_snapshot,
      host_formation: payload.host_formation,
      ally_formation: payload.ally_formation,
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
  return data as CoopRaidSessionDbRow | null;
}

function conflictResponse(session: CoopRaidSession, error: string) {
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
  if (!shouldUseOnlineCoopRaidSessions()) {
    return apiNotConfigured('Co-op raid action API');
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
    return Response.json({ ok: false, error: 'Invalid raid combat action.', deploymentMode: 'database' }, { status: 400 });
  }
  if (!Number.isFinite(expectedVersion) || expectedVersion < 1) {
    return Response.json({ ok: false, error: 'expectedVersion is required.', deploymentMode: 'database' }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = getCoopRaidSessionAdminClient();
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
      return Response.json({ ok: false, error: 'Raid session was not found.', deploymentMode: 'database' }, { status: 404 });
    }
    if (row.host_id !== userId && row.ally_id !== userId) {
      return Response.json({ ok: false, error: 'You are not part of this raid.', deploymentMode: 'database' }, { status: 403 });
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
      return Response.json({ ok: false, error: 'Raid session could not be loaded.', deploymentMode: 'database' }, { status: 500 });
    }

    const { data: existingAction, error: existingError } = await admin
      .from('coop_raid_actions')
      .select('action_id')
      .eq('session_id', id)
      .eq('action_id', action.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingAction) {
      return apiOk({ session, duplicate: true }, undefined, 'database');
    }

    if (session.version !== expectedVersion) {
      return conflictResponse(session, 'Raid session changed. Refresh before acting.');
    }

    const applied = applyCoopRaidAction(session, action, expectedVersion, now);
    if (!applied.success || !applied.session) {
      return Response.json({
        ok: false,
        error: applied.error || 'Could not apply raid action.',
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
      return conflictResponse(freshSession || session, 'Raid session changed. Refresh before acting.');
    }

    const { error: actionInsertError } = await admin
      .from('coop_raid_actions')
      .insert({
        session_id: id,
        action_id: action.id,
        actor_id: userId,
        expected_revision: action.expectedRevision,
        payload: action,
      });
    if (actionInsertError) {
      // Concurrent duplicate action_id: treat as idempotent success with written session.
      if (actionInsertError.code === '23505') {
        const savedDuplicate = hydrate(written, usernameById, now) || applied.session;
        return apiOk({ session: savedDuplicate, duplicate: true }, undefined, 'database');
      }
      throw actionInsertError;
    }

    const saved = hydrate(written, usernameById, now) || applied.session;
    return apiOk({ session: saved }, undefined, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply raid action.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
