import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import type { BattleChallenge, BattleChallengeStatus } from '@/lib/battle';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';

export const dynamic = 'force-dynamic';

const CHALLENGE_TTL_MS = 60_000;
const ACTIVE_CHALLENGE_STATUSES = ['pending', 'ready'];

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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

async function getProfileById(supabase: SupabaseServerClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileRow | null;
}

async function getProfileByUsername(supabase: SupabaseServerClient, username: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', username)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileRow | null;
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

export async function GET() {
  if (!isSupabaseConfigured()) {
    return apiNotConfigured('PVP challenge API');
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('pvp_challenges')
    .select('id, challenger_id, target_id, status, confirmed_by, expires_at, created_at, ready_at')
    .or(`challenger_id.eq.${userId},target_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return Response.json({ ok: false, error: error.message, deploymentMode: 'database' }, { status: 500 });
  }

  const challenges = await hydrateChallengeRows(supabase, (data || []) as PvpChallengeRow[]);
  return apiOk({ challenges }, undefined, 'database');
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiNotConfigured('PVP challenge API');
  }

  let body: { targetUsername?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const targetUsername = String(body.targetUsername || '').trim();
  if (!targetUsername) {
    return Response.json({ ok: false, error: 'Target username is required.', deploymentMode: 'database' }, { status: 400 });
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  try {
    const [challengerProfile, targetProfile] = await Promise.all([
      getProfileById(supabase, userId),
      getProfileByUsername(supabase, targetUsername),
    ]);

    if (!challengerProfile) {
      return Response.json({ ok: false, error: 'Your profile is missing.', deploymentMode: 'database' }, { status: 404 });
    }

    if (!targetProfile) {
      return Response.json({ ok: false, error: 'Target player was not found.', deploymentMode: 'database' }, { status: 404 });
    }

    if (targetProfile.id === userId) {
      return Response.json({ ok: false, error: 'You cannot challenge yourself.', deploymentMode: 'database' }, { status: 400 });
    }

    const [challengerLevel, targetLevel] = await Promise.all([
      getPlayerLevel(supabase, userId),
      getPlayerLevel(supabase, targetProfile.id),
    ]);
    const challengerUnlock = requireMultiplayerUnlock('pvp-challenges', challengerLevel);
    if (!challengerUnlock.allowed) {
      return Response.json({ ok: false, error: challengerUnlock.error, deploymentMode: 'database' }, { status: 403 });
    }
    const targetUnlock = requireMultiplayerUnlock('pvp-challenges', targetLevel);
    if (!targetUnlock.allowed) {
      return Response.json({
        ok: false,
        error: `${targetProfile.username} must reach level 3 before accepting duels.`,
        deploymentMode: 'database',
      }, { status: 403 });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('pvp_challenges')
      .select('id, challenger_id, target_id, status, confirmed_by, expires_at, created_at, ready_at')
      .or(`challenger_id.eq.${userId},target_id.eq.${userId}`)
      .in('status', ACTIVE_CHALLENGE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(30);

    if (existingError) throw existingError;

    const existing = ((existingRows || []) as PvpChallengeRow[]).find(row => (
      [row.challenger_id, row.target_id].includes(targetProfile.id)
    ));

    if (existing) {
      const [challenge] = await hydrateChallengeRows(supabase, [existing]);
      if (!challenge) {
        return Response.json({ ok: false, error: 'Existing challenge could not be loaded.', deploymentMode: 'database' }, { status: 500 });
      }
      return Response.json(
        { ok: false, error: 'A challenge with this player is already active.', data: { challenge }, deploymentMode: 'database' },
        { status: 409 },
      );
    }

    const now = new Date();
    const challengeRow = {
      id: `pvp-${crypto.randomUUID()}`,
      challenger_id: userId,
      target_id: targetProfile.id,
      status: 'pending',
      confirmed_by: [userId],
      expires_at: new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString(),
      created_at: now.toISOString(),
      ready_at: null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('pvp_challenges')
      .insert(challengeRow)
      .select('id, challenger_id, target_id, status, confirmed_by, expires_at, created_at, ready_at')
      .single();

    if (insertError) throw insertError;

    const [challenge] = await hydrateChallengeRows(supabase, [inserted as PvpChallengeRow]);
    if (!challenge) {
      return Response.json({ ok: false, error: 'Challenge was created but could not be loaded.', deploymentMode: 'database' }, { status: 500 });
    }
    return apiOk({ challenge }, { status: 201 }, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create challenge.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
