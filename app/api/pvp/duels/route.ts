import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import type { CharacterStats, MinionStack, User } from '@/lib/auth';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import {
  getPvpDuelSessionAdminClient,
  pvpDuelSessionFromDbRow,
  pvpDuelSessionToDbPayload,
  shouldUseOnlinePvpDuelSessions,
  type PvpDuelSessionDbRow,
} from '@/lib/pvpDuelSessionDb';
import { createPvpDuelSession } from '@/lib/pvpDuelSessions';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface ProfileRow {
  id: string;
  username: string;
  selected_model?: number;
}

interface PlayerStateRow {
  user_id: string;
  level: number | null;
  x: number | null;
  y: number | null;
  stats: CharacterStats | null;
  minions: MinionStack[] | null;
  known_spell_ids: string[] | null;
  equipped_spell_ids: string[] | null;
}

interface ChallengeRow {
  id: string;
  challenger_id: string;
  target_id: string;
  status: string;
  confirmed_by: string[] | null;
  expires_at: string;
  created_at: string;
  ready_at: string | null;
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

function defaultStats(level = 1): CharacterStats {
  return {
    armyPower: 4,
    defensivePower: 4,
    morale: 4,
    spellPower: 4,
    health: 40,
    maxHealth: 40,
    level,
    unallocatedPoints: 0,
  };
}

function userFromState(profile: ProfileRow, state: PlayerStateRow): User {
  const level = Number(state.level || state.stats?.level) || 1;
  const base = state.stats && typeof state.stats === 'object' ? state.stats : defaultStats(level);
  return {
    username: profile.username,
    password: '',
    gold: 0,
    exp: 0,
    x: Number(state.x) || 0,
    y: Number(state.y) || 0,
    inventory: [],
    equipment: [],
    equippedSlots: {},
    minions: Array.isArray(state.minions) ? state.minions : [],
    activityLog: [],
    stats: {
      ...defaultStats(level),
      ...base,
      level,
    },
    selectedModel: Number(profile.selected_model) || 3,
    knownSpellIds: Array.isArray(state.known_spell_ids) ? state.known_spell_ids : [],
    equippedSpellIds: Array.isArray(state.equipped_spell_ids) ? state.equipped_spell_ids : [],
    traveling: null,
    jobQueue: [],
  };
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return apiNotConfigured('PVP duel session API');
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('pvp_duel_sessions')
    .select('*')
    .or(`challenger_id.eq.${userId},target_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ ok: false, error: error.message, deploymentMode: 'database' }, { status: 500 });
  }

  const rows = (data || []) as PvpDuelSessionDbRow[];
  const profileIds = Array.from(new Set(rows.flatMap(row => [row.challenger_id, row.target_id])));
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', profileIds.length > 0 ? profileIds : ['00000000-0000-0000-0000-000000000000']);
  if (profileError) {
    return Response.json({ ok: false, error: profileError.message, deploymentMode: 'database' }, { status: 500 });
  }

  const usernameById = new Map((profiles as ProfileRow[] | null || []).map(profile => [profile.id, profile.username]));
  const sessions = rows
    .map(row => {
      const challengerUsername = usernameById.get(row.challenger_id);
      const defenderUsername = usernameById.get(row.target_id);
      if (!challengerUsername || !defenderUsername) return null;
      return pvpDuelSessionFromDbRow(row, challengerUsername, defenderUsername);
    })
    .filter((session): session is NonNullable<typeof session> => Boolean(session));

  return apiOk({ sessions, online: shouldUseOnlinePvpDuelSessions() }, undefined, 'database');
}

export async function POST(request: Request) {
  if (!shouldUseOnlinePvpDuelSessions()) {
    return apiNotConfigured('PVP duel session API');
  }

  let body: { challengeId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const challengeId = String(body.challengeId || '').trim();
  if (!challengeId) {
    return Response.json({ ok: false, error: 'challengeId is required.', deploymentMode: 'database' }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = getPvpDuelSessionAdminClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId || !admin) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  try {
    const unlock = requireMultiplayerUnlock('pvp-challenges', await getPlayerLevel(supabase, userId));
    if (!unlock.allowed) {
      return Response.json({ ok: false, error: unlock.error, deploymentMode: 'database' }, { status: 403 });
    }

    const { data: challengeData, error: challengeError } = await admin
      .from('pvp_challenges')
      .select('id, challenger_id, target_id, status, confirmed_by, expires_at, created_at, ready_at')
      .eq('id', challengeId)
      .maybeSingle();
    if (challengeError) throw challengeError;
    const challenge = challengeData as ChallengeRow | null;
    if (!challenge) {
      return Response.json({ ok: false, error: 'Challenge was not found.', deploymentMode: 'database' }, { status: 404 });
    }
    if (challenge.challenger_id !== userId && challenge.target_id !== userId) {
      return Response.json({ ok: false, error: 'You are not part of this challenge.', deploymentMode: 'database' }, { status: 403 });
    }
    if (challenge.status !== 'ready') {
      return Response.json({ ok: false, error: 'Both players must accept the challenge first.', deploymentMode: 'database' }, { status: 409 });
    }

    const existingId = `pvp-duel-${challenge.id}`;
    const { data: existingRow } = await admin
      .from('pvp_duel_sessions')
      .select('*')
      .eq('id', existingId)
      .maybeSingle();
    if (existingRow) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, username')
        .in('id', [challenge.challenger_id, challenge.target_id]);
      const usernameById = new Map((profiles as ProfileRow[] | null || []).map(profile => [profile.id, profile.username]));
      const session = pvpDuelSessionFromDbRow(
        existingRow as PvpDuelSessionDbRow,
        usernameById.get(challenge.challenger_id) || 'Challenger',
        usernameById.get(challenge.target_id) || 'Defender',
      );
      return apiOk({ session, duplicate: true }, undefined, 'database');
    }

    const [{ data: profiles, error: profileError }, { data: states, error: stateError }] = await Promise.all([
      admin.from('profiles').select('id, username, selected_model').in('id', [challenge.challenger_id, challenge.target_id]),
      admin.from('player_states').select('user_id, level, x, y, stats, minions, known_spell_ids, equipped_spell_ids').in('user_id', [challenge.challenger_id, challenge.target_id]),
    ]);
    if (profileError) throw profileError;
    if (stateError) throw stateError;

    const profileById = new Map((profiles as ProfileRow[] | null || []).map(profile => [profile.id, profile]));
    const stateById = new Map((states as PlayerStateRow[] | null || []).map(state => [state.user_id, state]));
    const challengerProfile = profileById.get(challenge.challenger_id);
    const defenderProfile = profileById.get(challenge.target_id);
    const challengerState = stateById.get(challenge.challenger_id);
    const defenderState = stateById.get(challenge.target_id);
    if (!challengerProfile || !defenderProfile || !challengerState || !defenderState) {
      return Response.json({ ok: false, error: 'Both player profiles are required to open a duel.', deploymentMode: 'database' }, { status: 404 });
    }

    const created = createPvpDuelSession(
      {
        id: challenge.id,
        challengerUsername: challengerProfile.username,
        targetUsername: defenderProfile.username,
        status: 'ready',
        readyAt: challenge.ready_at ? new Date(challenge.ready_at).getTime() : Date.now(),
      },
      userFromState(challengerProfile, challengerState),
      userFromState(defenderProfile, defenderState),
    );
    if (!created.success || !created.session) {
      return Response.json({ ok: false, error: created.error || 'Failed to create duel session.', deploymentMode: 'database' }, { status: 400 });
    }

    const payload = {
      ...pvpDuelSessionToDbPayload(created.session, challenge.challenger_id, challenge.target_id),
      created_at: new Date(created.session.createdAt).toISOString(),
      updated_at: new Date(created.session.updatedAt).toISOString(),
    };

    const { data: inserted, error: insertError } = await admin
      .from('pvp_duel_sessions')
      .insert(payload)
      .select('*')
      .single();
    if (insertError) throw insertError;

    const session = pvpDuelSessionFromDbRow(
      inserted as PvpDuelSessionDbRow,
      challengerProfile.username,
      defenderProfile.username,
    );
    return apiOk({ session }, { status: 201 }, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create duel session.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
