import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import type { BattleChallenge, BattleChallengeStatus } from '@/lib/battle';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ChallengeAction = 'confirm' | 'accept' | 'decline' | 'cancel';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ProfileRow {
  id: string;
  username: string;
}

interface PvpChallengeRow {
  id: string;
  challenger_id: string;
  target_id: string;
  status: string;
  confirmed_by: string[] | null;
  expires_at: string;
  created_at: string;
  ready_at?: string | null;
}

function isBattleChallengeStatus(status: string): status is BattleChallengeStatus {
  return ['pending', 'ready', 'declined', 'expired', 'cancelled'].includes(status);
}

function toTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

async function getAuthenticatedUserId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

async function hydrateChallengeRows(
  supabase: SupabaseServerClient,
  rows: PvpChallengeRow[],
  now = Date.now(),
): Promise<BattleChallenge[]> {
  const profileIds = Array.from(new Set(rows.flatMap(row => [
    row.challenger_id,
    row.target_id,
    ...(row.confirmed_by || []),
  ])));

  if (profileIds.length === 0) return [];

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', profileIds);

  if (error) throw error;

  const usernameById = new Map((profiles as ProfileRow[] | null || []).map(profile => [profile.id, profile.username]));

  const challenges: BattleChallenge[] = [];

  rows.forEach(row => {
    const challengerUsername = usernameById.get(row.challenger_id);
    const targetUsername = usernameById.get(row.target_id);
    if (!challengerUsername || !targetUsername) return;

    const participants = [challengerUsername, targetUsername];
    const confirmedBy = Array.from(new Set((row.confirmed_by || [])
      .map(userId => usernameById.get(userId))
      .filter((username): username is string => typeof username === 'string' && participants.includes(username))));

    const expiresAt = toTimestamp(row.expires_at) || now;
    let status: BattleChallengeStatus = isBattleChallengeStatus(row.status) ? row.status : 'pending';

    if (status === 'pending' && expiresAt <= now) {
      status = 'expired';
    }

    if (status === 'pending' && confirmedBy.length === participants.length) {
      status = 'ready';
    }

    challenges.push({
      id: row.id,
      challengerUsername,
      targetUsername,
      createdAt: toTimestamp(row.created_at) || now,
      expiresAt,
      status,
      confirmedBy,
      readyAt: toTimestamp(row.ready_at) || (status === 'ready' ? now : undefined),
    });
  });

  return challenges;
}

async function getChallengeRow(supabase: SupabaseServerClient, challengeId: string): Promise<PvpChallengeRow | null> {
  const { data, error } = await supabase
    .from('pvp_challenges')
    .select('id, challenger_id, target_id, status, confirmed_by, expires_at, created_at, ready_at')
    .eq('id', challengeId)
    .maybeSingle();

  if (error) throw error;
  return data as PvpChallengeRow | null;
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

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return apiNotConfigured('PVP challenge API');
  }

  const { id } = await context.params;
  let body: { action?: ChallengeAction };

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const action = body.action;
  if (!action || !['confirm', 'accept', 'decline', 'cancel'].includes(action)) {
    return Response.json({ ok: false, error: 'Invalid challenge action.', deploymentMode: 'database' }, { status: 400 });
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  try {
    if (action === 'confirm' || action === 'accept') {
      const unlock = requireMultiplayerUnlock('pvp-challenges', await getPlayerLevel(supabase, userId));
      if (!unlock.allowed) {
        return Response.json({ ok: false, error: unlock.error, deploymentMode: 'database' }, { status: 403 });
      }
    }

    const row = await getChallengeRow(supabase, id);
    if (!row) {
      return Response.json({ ok: false, error: 'Challenge was not found.', deploymentMode: 'database' }, { status: 404 });
    }

    const participants = [row.challenger_id, row.target_id];
    if (!participants.includes(userId)) {
      return Response.json({ ok: false, error: 'You are not part of this challenge.', deploymentMode: 'database' }, { status: 403 });
    }

    const now = new Date();
    if (row.status === 'pending' && new Date(row.expires_at).getTime() <= now.getTime()) {
      const { data: expiredRow, error: expireError } = await supabase
        .from('pvp_challenges')
        .update({ status: 'expired' })
        .eq('id', row.id)
        .select('id, challenger_id, target_id, status, confirmed_by, expires_at, created_at, ready_at')
        .single();

      if (expireError) throw expireError;
      const [challenge] = await hydrateChallengeRows(supabase, [expiredRow as PvpChallengeRow], now.getTime());
      if (!challenge) {
        return Response.json({ ok: false, error: 'Expired challenge could not be loaded.', deploymentMode: 'database' }, { status: 500 });
      }
      return Response.json(
        { ok: false, error: 'Challenge expired.', data: { challenge }, deploymentMode: 'database' },
        { status: 409 },
      );
    }

    if (action === 'cancel' && row.challenger_id !== userId) {
      return Response.json({ ok: false, error: 'Only the challenger can cancel this challenge.', deploymentMode: 'database' }, { status: 403 });
    }

    if (row.status !== 'pending' && !(action === 'cancel' && row.status === 'ready')) {
      const [challenge] = await hydrateChallengeRows(supabase, [row]);
      if (!challenge) {
        return Response.json({ ok: false, error: 'Challenge could not be loaded.', deploymentMode: 'database' }, { status: 500 });
      }
      return Response.json(
        { ok: false, error: 'Challenge is no longer pending.', data: { challenge }, deploymentMode: 'database' },
        { status: 409 },
      );
    }

    let update: { status: BattleChallengeStatus; confirmed_by?: string[]; ready_at?: string | null };

    if (action === 'decline') {
      update = { status: 'declined' };
    } else if (action === 'cancel') {
      update = { status: 'cancelled' };
    } else {
      const confirmedBy = Array.from(new Set([...(row.confirmed_by || []), userId]));
      const ready = participants.every(participantId => confirmedBy.includes(participantId));
      update = {
        status: ready ? 'ready' : 'pending',
        confirmed_by: confirmedBy,
        ready_at: ready ? now.toISOString() : row.ready_at || null,
      };
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from('pvp_challenges')
      .update(update)
      .eq('id', row.id)
      .select('id, challenger_id, target_id, status, confirmed_by, expires_at, created_at, ready_at')
      .single();

    if (updateError) throw updateError;

    const [challenge] = await hydrateChallengeRows(supabase, [updatedRow as PvpChallengeRow]);
    if (!challenge) {
      return Response.json({ ok: false, error: 'Updated challenge could not be loaded.', deploymentMode: 'database' }, { status: 500 });
    }
    return apiOk({ challenge }, undefined, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update challenge.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
