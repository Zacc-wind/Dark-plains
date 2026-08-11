import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import type { CharacterStats, MinionStack, PartyState, User } from '@/lib/auth';
import { getActiveCoopBosses } from '@/lib/battle';
import {
  coopRaidSessionFromDbRow,
  coopRaidSessionToDbPayload,
  getCoopRaidSessionAdminClient,
  shouldUseOnlineCoopRaidSessions,
  type CoopRaidSessionDbRow,
} from '@/lib/coopRaidSessionDb';
import { createCoopRaidSession } from '@/lib/coopRaidSessions';
import { multiplayerUnlockForbiddenResponse } from '@/lib/multiplayerUnlockGate';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

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

function hydrateRow(
  row: CoopRaidSessionDbRow,
  usernameById: Map<string, string>,
  now = Date.now(),
) {
  const hostUsername = usernameById.get(row.host_id);
  const allyUsername = usernameById.get(row.ally_id);
  if (!hostUsername || !allyUsername) return null;
  return coopRaidSessionFromDbRow(row, hostUsername, allyUsername, now);
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return apiNotConfigured('Co-op raid session API');
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('coop_raid_sessions')
    .select('*')
    .or(`host_id.eq.${userId},ally_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ ok: false, error: error.message, deploymentMode: 'database' }, { status: 500 });
  }

  const rows = (data || []) as CoopRaidSessionDbRow[];
  const profileIds = Array.from(new Set(rows.flatMap(row => [row.host_id, row.ally_id])));
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', profileIds.length > 0 ? profileIds : ['00000000-0000-0000-0000-000000000000']);
  if (profileError) {
    return Response.json({ ok: false, error: profileError.message, deploymentMode: 'database' }, { status: 500 });
  }

  const usernameById = new Map((profiles as ProfileRow[] | null || []).map(profile => [profile.id, profile.username]));
  const sessions = rows
    .map(row => hydrateRow(row, usernameById))
    .filter((session): session is NonNullable<typeof session> => Boolean(session));

  return apiOk({ sessions, online: shouldUseOnlineCoopRaidSessions() }, undefined, 'database');
}

export async function POST(request: Request) {
  if (!shouldUseOnlineCoopRaidSessions()) {
    return apiNotConfigured('Co-op raid session API');
  }

  let body: { bossId?: string; allyUsername?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const bossId = String(body.bossId || '').trim();
  const allyUsername = String(body.allyUsername || '').trim();
  if (!bossId) {
    return Response.json({ ok: false, error: 'bossId is required.', deploymentMode: 'database' }, { status: 400 });
  }
  if (!allyUsername) {
    return Response.json({ ok: false, error: 'allyUsername is required.', deploymentMode: 'database' }, { status: 400 });
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
      return multiplayerUnlockForbiddenResponse(unlock.error);
    }

    const { data: hostProfileData, error: hostProfileError } = await admin
      .from('profiles')
      .select('id, username, selected_model')
      .eq('id', userId)
      .maybeSingle();
    if (hostProfileError) throw hostProfileError;
    const hostProfile = hostProfileData as ProfileRow | null;
    if (!hostProfile) {
      return Response.json({ ok: false, error: 'Your profile is missing.', deploymentMode: 'database' }, { status: 404 });
    }

    const { data: allyProfileData, error: allyProfileError } = await admin
      .from('profiles')
      .select('id, username, selected_model')
      .ilike('username', allyUsername)
      .maybeSingle();
    if (allyProfileError) throw allyProfileError;
    const allyProfile = allyProfileData as ProfileRow | null;
    if (!allyProfile) {
      return Response.json({ ok: false, error: 'Ally commander was not found.', deploymentMode: 'database' }, { status: 404 });
    }
    if (allyProfile.id === userId) {
      return Response.json({ ok: false, error: 'Choose a different ally for the raid.', deploymentMode: 'database' }, { status: 400 });
    }

    const now = Date.now();
    const { data: existingRows, error: existingError } = await admin
      .from('coop_raid_sessions')
      .select('*')
      .eq('boss_id', bossId)
      .or(`and(host_id.eq.${userId},ally_id.eq.${allyProfile.id}),and(host_id.eq.${allyProfile.id},ally_id.eq.${userId})`)
      .order('updated_at', { ascending: false })
      .limit(5);
    if (existingError) throw existingError;

    const usernameById = new Map([
      [hostProfile.id, hostProfile.username],
      [allyProfile.id, allyProfile.username],
    ]);

    const existingSessions = ((existingRows || []) as CoopRaidSessionDbRow[])
      .map(row => hydrateRow(row, usernameById, now))
      .filter((session): session is NonNullable<typeof session> => Boolean(session));

    const existing = existingSessions.find(session => (
      session.phase !== 'abandoned' && session.phase !== 'expired'
    ));
    if (existing) {
      const currentClaimed = Boolean(existing.result?.claimReceipts.some(receipt => (
        receipt.username.toLowerCase() === hostProfile.username.toLowerCase()
      )));
      const allReportsClosed = Boolean(
        existing.result
        && existing.result.claimReceipts.length >= 2
      );
      const retryable = existing.phase === 'completed'
        && existing.result?.outcome !== 'victory'
        && allReportsClosed;

      if (existing.result?.outcome === 'victory' && currentClaimed) {
        return Response.json({
          ok: false,
          error: 'You already cleared and claimed this incursion.',
          data: { session: existing },
          deploymentMode: 'database',
        }, { status: 409 });
      }
      if (!retryable) {
        return apiOk({ session: existing, duplicate: true }, undefined, 'database');
      }
    }

    const [{ data: states, error: stateError }] = await Promise.all([
      admin
        .from('player_states')
        .select('user_id, level, x, y, stats, minions, known_spell_ids, equipped_spell_ids')
        .in('user_id', [userId, allyProfile.id]),
    ]);
    if (stateError) throw stateError;

    const stateById = new Map((states as PlayerStateRow[] | null || []).map(state => [state.user_id, state]));
    const hostState = stateById.get(userId);
    const allyState = stateById.get(allyProfile.id);
    if (!hostState || !allyState) {
      return Response.json({ ok: false, error: 'Both player profiles are required to prepare the raid.', deploymentMode: 'database' }, { status: 404 });
    }

    const host = userFromState(hostProfile, hostState);
    const ally = userFromState(allyProfile, allyState);
    const boss = getActiveCoopBosses(host, now).find(candidate => candidate.id === bossId);
    if (!boss) {
      return Response.json({ ok: false, error: 'That co-op incursion is no longer active.', deploymentMode: 'database' }, { status: 404 });
    }

    const party: PartyState = {
      leaderUsername: host.username,
      memberUsernames: [host.username, ally.username],
      invitedUsernames: [],
      updatedAt: now,
    };
    const created = createCoopRaidSession(party, host, ally, boss, now);
    if (!created.success || !created.session) {
      return Response.json({ ok: false, error: created.error || 'Failed to create raid session.', deploymentMode: 'database' }, { status: 400 });
    }

    const payload = {
      ...coopRaidSessionToDbPayload(created.session, userId, allyProfile.id),
      created_at: new Date(created.session.createdAt).toISOString(),
      updated_at: new Date(created.session.updatedAt).toISOString(),
    };

    const { data: inserted, error: insertError } = await admin
      .from('coop_raid_sessions')
      .insert(payload)
      .select('*')
      .single();
    if (insertError) throw insertError;

    const session = coopRaidSessionFromDbRow(
      inserted as CoopRaidSessionDbRow,
      host.username,
      ally.username,
      now,
    );
    return apiOk({ session }, { status: 201 }, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create raid session.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
