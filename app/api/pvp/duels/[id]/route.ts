import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';
import { createClient } from '@/lib/supabase/server';
import {
  getPvpDuelSessionAdminClient,
  pvpDuelSessionFromDbRow,
  pvpDuelSessionToDbPayload,
  shouldUseOnlinePvpDuelSessions,
  type PvpDuelSessionDbRow,
} from '@/lib/pvpDuelSessionDb';
import {
  cancelPvpDuelSession,
  confirmPvpDuelFormation,
  forfeitPvpDuelSession,
  markPvpDuelRatingApplied,
  type PvpDuelSession,
} from '@/lib/pvpDuelSessions';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = NonNullable<ReturnType<typeof getPvpDuelSessionAdminClient>>;
type DuelPatchAction = 'confirm_formation' | 'cancel' | 'forfeit' | 'settle';

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

async function loadRow(admin: AdminClient, sessionId: string): Promise<PvpDuelSessionDbRow | null> {
  const { data, error } = await admin
    .from('pvp_duel_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data as PvpDuelSessionDbRow | null;
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
  row: PvpDuelSessionDbRow,
  usernameById: Map<string, string>,
  now = Date.now(),
): PvpDuelSession | null {
  const challengerUsername = usernameById.get(row.challenger_id);
  const defenderUsername = usernameById.get(row.target_id);
  if (!challengerUsername || !defenderUsername) return null;
  return pvpDuelSessionFromDbRow(row, challengerUsername, defenderUsername, now);
}

async function writeVersioned(
  admin: AdminClient,
  session: PvpDuelSession,
  challengerId: string,
  targetId: string,
  expectedVersion: number,
): Promise<PvpDuelSessionDbRow | null> {
  const payload = pvpDuelSessionToDbPayload(session, challengerId, targetId);
  const { data, error } = await admin
    .from('pvp_duel_sessions')
    .update({
      phase: payload.phase,
      version: payload.version,
      challenger_snapshot: payload.challenger_snapshot,
      target_snapshot: payload.target_snapshot,
      challenger_formation: payload.challenger_formation,
      target_formation: payload.target_formation,
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
  return data as PvpDuelSessionDbRow | null;
}

function conflictResponse(session: PvpDuelSession, error: string) {
  return Response.json(
    { ok: false, error, data: { session }, deploymentMode: 'database' },
    { status: 409 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!shouldUseOnlinePvpDuelSessions()) {
    return apiNotConfigured('PVP duel session API');
  }

  const { id } = await context.params;
  let body: {
    action?: DuelPatchAction;
    expectedVersion?: number;
    placements?: Record<string, { x: number; y: number }>;
    equippedSpellIds?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const action = body.action;
  const expectedVersion = Math.floor(Number(body.expectedVersion));
  if (!action || !['confirm_formation', 'cancel', 'forfeit', 'settle'].includes(action)) {
    return Response.json({ ok: false, error: 'Invalid duel action.', deploymentMode: 'database' }, { status: 400 });
  }
  if (!Number.isFinite(expectedVersion) || expectedVersion < 1) {
    return Response.json({ ok: false, error: 'expectedVersion is required.', deploymentMode: 'database' }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = getPvpDuelSessionAdminClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId || !admin) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  try {
    const unlock = requireMultiplayerUnlock('pvp-challenges', await getPlayerLevel(supabase, userId));
    if (!unlock.allowed && action !== 'cancel') {
      return Response.json({ ok: false, error: unlock.error, deploymentMode: 'database' }, { status: 403 });
    }

    const row = await loadRow(admin, id);
    if (!row) {
      return Response.json({ ok: false, error: 'Duel session was not found.', deploymentMode: 'database' }, { status: 404 });
    }
    if (row.challenger_id !== userId && row.target_id !== userId) {
      return Response.json({ ok: false, error: 'You are not part of this duel.', deploymentMode: 'database' }, { status: 403 });
    }

    const usernameById = await getUsernameMap(admin, [row.challenger_id, row.target_id]);
    const username = usernameById.get(userId);
    if (!username) {
      return Response.json({ ok: false, error: 'Your profile is missing.', deploymentMode: 'database' }, { status: 404 });
    }

    const now = Date.now();
    let session = hydrate(row, usernameById, now);
    if (!session) {
      return Response.json({ ok: false, error: 'Duel session could not be loaded.', deploymentMode: 'database' }, { status: 500 });
    }

    if (session.version !== expectedVersion && action !== 'settle') {
      return conflictResponse(session, 'Duel session changed. Refresh before continuing.');
    }

    let nextSession = session;
    let duplicate = false;

    if (action === 'confirm_formation') {
      const result = confirmPvpDuelFormation(
        session,
        username,
        body.placements || {},
        body.equippedSpellIds || [],
        expectedVersion,
        now,
      );
      if (!result.success || !result.session) {
        return Response.json({
          ok: false,
          error: result.error || 'Could not confirm formation.',
          data: { session: result.session || session },
          deploymentMode: 'database',
        }, { status: 409 });
      }
      nextSession = result.session;
      duplicate = Boolean(result.duplicate);
    } else if (action === 'cancel') {
      const result = cancelPvpDuelSession(session, username, expectedVersion, now);
      if (!result.success || !result.session) {
        return Response.json({
          ok: false,
          error: result.error || 'Could not cancel duel.',
          data: { session: result.session || session },
          deploymentMode: 'database',
        }, { status: 409 });
      }
      nextSession = result.session;
      duplicate = Boolean(result.duplicate);
    } else if (action === 'forfeit') {
      const result = forfeitPvpDuelSession(session, username, expectedVersion, now);
      if (!result.success || !result.session) {
        return Response.json({
          ok: false,
          error: result.error || 'Could not forfeit duel.',
          data: { session: result.session || session },
          deploymentMode: 'database',
        }, { status: 409 });
      }
      nextSession = result.session;
      duplicate = Boolean(result.duplicate);
    } else {
      if (session.phase !== 'completed' || !session.result) {
        return Response.json({
          ok: false,
          error: 'Duel result is not ready.',
          data: { session },
          deploymentMode: 'database',
        }, { status: 409 });
      }
      if (session.result.ratingApplied) {
        return apiOk({ session, duplicate: true }, undefined, 'database');
      }
      const marked = markPvpDuelRatingApplied(session, now);
      if (!marked.success || !marked.session) {
        return Response.json({
          ok: false,
          error: marked.error || 'Could not mark duel settled.',
          data: { session },
          deploymentMode: 'database',
        }, { status: 409 });
      }
      nextSession = marked.session;
    }

    if (duplicate && nextSession.version === session.version) {
      return apiOk({ session: nextSession, duplicate: true }, undefined, 'database');
    }

    const written = await writeVersioned(
      admin,
      nextSession,
      row.challenger_id,
      row.target_id,
      expectedVersion,
    );
    if (!written) {
      const fresh = await loadRow(admin, id);
      const freshSession = fresh ? hydrate(fresh, usernameById, now) : session;
      return conflictResponse(freshSession || session, 'Duel session changed. Refresh before continuing.');
    }

    const saved = hydrate(written, usernameById, now) || nextSession;
    return apiOk({ session: saved, ...(duplicate ? { duplicate: true } : {}) }, undefined, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update duel session.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
