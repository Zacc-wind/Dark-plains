import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import {
  coopRaidSessionFromDbRow,
  coopRaidSessionToDbPayload,
  getCoopRaidSessionAdminClient,
  shouldUseOnlineCoopRaidSessions,
  type CoopRaidSessionDbRow,
} from '@/lib/coopRaidSessionDb';
import {
  abandonCoopRaidSession,
  confirmCoopRaidFormation,
  getCoopRaidReward,
  markCoopRaidClaimed,
  type CoopRaidSession,
} from '@/lib/coopRaidSessions';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = NonNullable<ReturnType<typeof getCoopRaidSessionAdminClient>>;
type RaidPatchAction = 'confirm_formation' | 'abandon' | 'settle';

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

export async function PATCH(request: Request, context: RouteContext) {
  if (!shouldUseOnlineCoopRaidSessions()) {
    return apiNotConfigured('Co-op raid session API');
  }

  const { id } = await context.params;
  let body: {
    action?: RaidPatchAction;
    expectedVersion?: number;
    placements?: Record<string, { x: number; y: number }>;
    equippedSpellIds?: string[];
    equipmentName?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const action = body.action;
  const expectedVersion = Math.floor(Number(body.expectedVersion));
  if (!action || !['confirm_formation', 'abandon', 'settle'].includes(action)) {
    return Response.json({ ok: false, error: 'Invalid raid action.', deploymentMode: 'database' }, { status: 400 });
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
    if (!unlock.allowed && action !== 'abandon') {
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

    const now = Date.now();
    let session = hydrate(row, usernameById, now);
    if (!session) {
      return Response.json({ ok: false, error: 'Raid session could not be loaded.', deploymentMode: 'database' }, { status: 500 });
    }

    if (session.version !== expectedVersion) {
      return conflictResponse(session, 'Raid session changed. Refresh before continuing.');
    }

    let nextSession = session;
    let duplicate = false;
    let claimReward: Record<string, unknown> | null = null;
    let equipmentName: string | undefined;

    if (action === 'confirm_formation') {
      const result = confirmCoopRaidFormation(
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
    } else if (action === 'abandon') {
      const result = abandonCoopRaidSession(session, username, expectedVersion, now);
      if (!result.success || !result.session) {
        return Response.json({
          ok: false,
          error: result.error || 'Could not abandon raid.',
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
          error: 'Raid result is not ready.',
          data: { session },
          deploymentMode: 'database',
        }, { status: 409 });
      }

      equipmentName = typeof body.equipmentName === 'string' && body.equipmentName.trim()
        ? body.equipmentName.trim().slice(0, 120)
        : undefined;
      const marked = markCoopRaidClaimed(session, username, expectedVersion, equipmentName, now);
      if (!marked.success || !marked.session) {
        return Response.json({
          ok: false,
          error: marked.error || 'Could not settle raid.',
          data: { session: marked.session || session },
          deploymentMode: 'database',
        }, { status: 409 });
      }
      nextSession = marked.session;
      duplicate = Boolean(marked.duplicate);
      if (!duplicate) {
        const receipt = nextSession.result?.claimReceipts.find(item => (
          item.username.toLowerCase() === username.toLowerCase()
        ));
        claimReward = receipt?.reward
          ? { ...receipt.reward }
          : { ...getCoopRaidReward(session, username) };
      }
    }

    if (duplicate && nextSession.version === session.version) {
      return apiOk({ session: nextSession, duplicate: true }, undefined, 'database');
    }

    const written = await writeVersioned(
      admin,
      nextSession,
      row.host_id,
      row.ally_id,
      expectedVersion,
    );
    if (!written) {
      const fresh = await loadRow(admin, id);
      const freshSession = fresh ? hydrate(fresh, usernameById, now) : session;
      return conflictResponse(freshSession || session, 'Raid session changed. Refresh before continuing.');
    }

    if (action === 'settle' && claimReward) {
      const { error: claimError } = await admin
        .from('coop_raid_claims')
        .upsert({
          session_id: nextSession.id,
          user_id: userId,
          reward: claimReward,
          equipment_id: equipmentName || null,
          claimed_at: new Date(now).toISOString(),
        }, { onConflict: 'session_id,user_id' });
      if (claimError) throw claimError;
    }

    const saved = hydrate(written, usernameById, now) || nextSession;
    return apiOk({ session: saved, ...(duplicate ? { duplicate: true } : {}) }, undefined, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update raid session.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
