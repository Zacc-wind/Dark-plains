import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import {
  evaluatePartyInviteUnlock,
  shouldUseOnlinePartySessions,
} from '@/lib/partyApi';
import {
  ensurePartyForLeader,
  evaluatePartyCapacity,
  findPartyForUser,
  getPartySessionAdminClient,
  insertPendingPartyInvite,
} from '@/lib/partySessionDb';
import { multiplayerUnlockForbiddenResponse } from '@/lib/multiplayerUnlockGate';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthenticatedUserId } from '@/lib/supabase/requireAuth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface ProfileRow {
  id: string;
  username: string;
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

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiNotConfigured('Party invite API');
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

  if (!shouldUseOnlinePartySessions()) {
    return apiNotConfigured('Online party invite persistence');
  }

  const admin = getPartySessionAdminClient();
  if (!admin) {
    return apiNotConfigured('Online party invite persistence');
  }

  try {
    const [actorProfile, targetProfile] = await Promise.all([
      getProfileById(supabase, userId),
      getProfileByUsername(supabase, targetUsername),
    ]);

    if (!actorProfile) {
      return Response.json({ ok: false, error: 'Your profile is missing.', deploymentMode: 'database' }, { status: 404 });
    }
    if (!targetProfile) {
      return Response.json({ ok: false, error: 'Target player was not found.', deploymentMode: 'database' }, { status: 404 });
    }
    if (targetProfile.id === userId) {
      return Response.json({ ok: false, error: 'You cannot invite yourself.', deploymentMode: 'database' }, { status: 400 });
    }

    const [actorLevel, targetLevel] = await Promise.all([
      getPlayerLevel(supabase, userId),
      getPlayerLevel(supabase, targetProfile.id),
    ]);
    const unlock = evaluatePartyInviteUnlock(actorLevel, targetLevel, targetProfile.username);
    if (!unlock.allowed) {
      return multiplayerUnlockForbiddenResponse(unlock.error);
    }

    const inviteeParty = await findPartyForUser(admin, targetProfile.id);
    if (inviteeParty) {
      return Response.json({
        ok: false,
        error: `${targetProfile.username} already has a party or pending invite.`,
        deploymentMode: 'database',
      }, { status: 409 });
    }

    const { data: pendingInvite } = await admin
      .from('party_invites')
      .select('id')
      .eq('invitee_id', targetProfile.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingInvite) {
      return Response.json({
        ok: false,
        error: 'Invite already sent.',
        deploymentMode: 'database',
      }, { status: 409 });
    }

    const { party, memberIds } = await ensurePartyForLeader(admin, userId);
    const capacity = evaluatePartyCapacity(memberIds.length);
    if (!capacity.allowed) {
      return Response.json({ ok: false, error: capacity.error, deploymentMode: 'database' }, { status: 409 });
    }

    const invite = await insertPendingPartyInvite(admin, {
      partyId: party.id,
      inviterId: userId,
      inviteeId: targetProfile.id,
    });

    return apiOk({
      partyId: party.id,
      inviteId: invite.id,
      memberIds,
    }, undefined, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Party invite failed.';
    const status = /leader|full|already/i.test(message) ? 409 : 500;
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status });
  }
}
